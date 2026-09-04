import "server-only";

import {
  isAllowedAudioContentType,
  isAudioContentTypeAllowedForExtension,
  MAX_STAGED_AUDIO_BYTES,
  type AllowedAudioContentType,
} from "@/src/application/contracts/audio-format";
import {
  validateStagedAudioPathname,
  type ValidatedStagedAudioPath,
} from "@/src/application/contracts/staged-audio";
import { InvalidAudio } from "@/src/application/errors";
import type { UserId } from "@/src/domain/user";

const OPAQUE_ETAG_CHARACTERS = /^[\x21-\x7e]+$/;

export interface StagedAudioBlobMetadata {
  readonly pathname: unknown;
  readonly etag: unknown;
  readonly size: unknown;
  readonly contentType: unknown;
}

export interface ValidatedStagedAudioMetadata extends ValidatedStagedAudioPath {
  readonly etag: string;
  readonly size: number;
  readonly contentType: AllowedAudioContentType;
}

export function validateStagedAudioEtag(etag: string): string {
  if (
    typeof etag !== "string" ||
    etag.length === 0 ||
    etag.length > 512 ||
    !OPAQUE_ETAG_CHARACTERS.test(etag)
  ) {
    throw new InvalidAudio("Invalid staged audio ETag");
  }
  return etag;
}

/** Validates Blob metadata against the client-held opaque reference. */
export function validateStagedAudioMetadata(
  userId: UserId,
  expectedPathname: string,
  expectedEtag: string,
  metadata: StagedAudioBlobMetadata,
): ValidatedStagedAudioMetadata {
  const path = validateStagedAudioPathname(userId, expectedPathname);
  const etag = validateStagedAudioEtag(expectedEtag);

  if (metadata.pathname !== path.pathname) {
    throw new InvalidAudio("Staged audio pathname changed");
  }
  if (metadata.etag !== etag) {
    throw new InvalidAudio("Staged audio ETag changed");
  }
  if (
    typeof metadata.size !== "number" ||
    !Number.isSafeInteger(metadata.size) ||
    metadata.size <= 0 ||
    metadata.size > MAX_STAGED_AUDIO_BYTES
  ) {
    throw new InvalidAudio("Invalid staged audio size");
  }
  if (
    typeof metadata.contentType !== "string" ||
    !isAllowedAudioContentType(metadata.contentType) ||
    !isAudioContentTypeAllowedForExtension(path.extension, metadata.contentType)
  ) {
    throw new InvalidAudio("Invalid staged audio content type");
  }

  return {
    ...path,
    etag,
    size: metadata.size,
    contentType: metadata.contentType,
  };
}
