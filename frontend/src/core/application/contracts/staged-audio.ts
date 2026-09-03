import type { UserId } from "../../domain/user";
import { InvalidAudio } from "../errors";
import { AudioSample } from "./audio";

export const STAGED_AUDIO_ROOT = "speech-staging";
export const MAX_STAGED_AUDIO_BYTES = AudioSample.MAX_CONTENT_BYTES;
export const MAX_STAGED_AUDIO_BASENAME_LENGTH = 255;

/** Formats accepted by OpenAI's file transcription endpoint. */
export const ALLOWED_AUDIO_EXTENSIONS = [
  "flac",
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "m4a",
  "ogg",
  "wav",
  "webm",
] as const;

export type AllowedAudioExtension = (typeof ALLOWED_AUDIO_EXTENSIONS)[number];

/**
 * Canonical and commonly emitted audio MIME types for the supported formats.
 * This list is also suitable for Vercel Blob's `allowedContentTypes` option.
 */
export const ALLOWED_AUDIO_CONTENT_TYPES = [
  "audio/flac",
  "audio/x-flac",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/ogg",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/webm",
] as const;

export type AllowedAudioContentType =
  (typeof ALLOWED_AUDIO_CONTENT_TYPES)[number];

const CONTENT_TYPES_BY_EXTENSION: Readonly<
  Record<AllowedAudioExtension, readonly AllowedAudioContentType[]>
> = {
  flac: ["audio/flac", "audio/x-flac"],
  mp3: ["audio/mpeg", "audio/mp3"],
  mp4: ["audio/mp4"],
  mpeg: ["audio/mpeg"],
  mpga: ["audio/mpeg"],
  m4a: ["audio/mp4", "audio/x-m4a"],
  ogg: ["audio/ogg"],
  wav: ["audio/wav", "audio/wave", "audio/x-wav"],
  webm: ["audio/webm"],
};

const SAFE_OWNER_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const SAFE_BASENAME_CHARACTERS = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const OPAQUE_ETAG_CHARACTERS = /^[\x21-\x7e]+$/;

export interface ValidatedStagedAudioPath {
  readonly pathname: string;
  readonly basename: string;
  readonly extension: AllowedAudioExtension;
}

export interface StagedAudioMetadata {
  readonly pathname: unknown;
  readonly etag: unknown;
  readonly size: unknown;
  readonly contentType: unknown;
}

export interface ValidatedStagedAudioMetadata
  extends ValidatedStagedAudioPath {
  readonly etag: string;
  readonly size: number;
  readonly contentType: AllowedAudioContentType;
}

export function stagedAudioOwnerPrefix(userId: UserId): string {
  if (!SAFE_OWNER_SEGMENT.test(userId)) {
    throw new InvalidAudio("Invalid staged audio owner");
  }
  return `${STAGED_AUDIO_ROOT}/${userId}/`;
}

/** Builds the bounded per-user staging slot for one supported audio format. */
export function buildStagedAudioPathname(
  userId: UserId,
  extension: AllowedAudioExtension,
): string {
  if (!isAllowedAudioExtension(extension)) {
    throw new InvalidAudio("Unsupported staged audio filename extension");
  }
  return `${stagedAudioOwnerPrefix(userId)}audio.${extension}`;
}

export function validateStagedAudioBasename(
  basename: string,
): Pick<ValidatedStagedAudioPath, "basename" | "extension"> {
  if (
    typeof basename !== "string" ||
    basename.length === 0 ||
    basename.length > MAX_STAGED_AUDIO_BASENAME_LENGTH ||
    !SAFE_BASENAME_CHARACTERS.test(basename) ||
    basename.includes("..") ||
    basename.includes("/") ||
    basename.includes("\\")
  ) {
    throw new InvalidAudio("Invalid staged audio filename");
  }

  const separator = basename.lastIndexOf(".");
  const extension = basename.slice(separator + 1);
  if (
    separator <= 0 ||
    !isAllowedAudioExtension(extension) ||
    extension !== extension.toLowerCase()
  ) {
    throw new InvalidAudio("Unsupported staged audio filename extension");
  }

  return { basename, extension };
}

/** Enforces exact ownership and one fixed slot for each supported format. */
export function validateStagedAudioPathname(
  userId: UserId,
  pathname: string,
): ValidatedStagedAudioPath {
  if (typeof pathname !== "string") {
    throw new InvalidAudio("Invalid staged audio pathname");
  }

  const prefix = stagedAudioOwnerPrefix(userId);
  if (!pathname.startsWith(prefix)) {
    throw new InvalidAudio("Staged audio does not belong to this user");
  }

  const basename = pathname.slice(prefix.length);
  const validated = validateStagedAudioBasename(basename);
  if (
    pathname !== `${prefix}${validated.basename}` ||
    validated.basename !== `audio.${validated.extension}`
  ) {
    throw new InvalidAudio("Invalid staged audio pathname");
  }

  return { pathname, ...validated };
}

export function isOwnedStagedAudioPathname(
  userId: UserId,
  pathname: string,
): boolean {
  try {
    validateStagedAudioPathname(userId, pathname);
    return true;
  } catch {
    return false;
  }
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

export function isAllowedAudioExtension(
  value: string,
): value is AllowedAudioExtension {
  return (ALLOWED_AUDIO_EXTENSIONS as readonly string[]).includes(value);
}

export function isAllowedAudioContentType(
  value: string,
): value is AllowedAudioContentType {
  return (ALLOWED_AUDIO_CONTENT_TYPES as readonly string[]).includes(value);
}

export function isAudioContentTypeAllowedForExtension(
  extension: AllowedAudioExtension,
  contentType: string,
): contentType is AllowedAudioContentType {
  return CONTENT_TYPES_BY_EXTENSION[extension].includes(
    contentType as AllowedAudioContentType,
  );
}

/**
 * Validates metadata returned by Blob against the client-held opaque reference.
 * URLs are deliberately absent from this boundary.
 */
export function validateStagedAudioMetadata(
  userId: UserId,
  expectedPathname: string,
  expectedEtag: string,
  metadata: StagedAudioMetadata,
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
    !isAudioContentTypeAllowedForExtension(
      path.extension,
      metadata.contentType,
    )
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
