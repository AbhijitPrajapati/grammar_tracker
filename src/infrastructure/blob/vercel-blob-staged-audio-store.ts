import "server-only";

import {
  BlobNotFoundError,
  del as vercelBlobDelete,
  get as vercelBlobGet,
  head as vercelBlobHead,
} from "@vercel/blob";

import { AudioSample } from "@/src/application/contracts/audio-sample";
import {
  isAllowedAudioContentType,
  isAudioContentTypeAllowedForExtension,
  MAX_AUDIO_INPUT_BYTES,
  type AllowedAudioContentType,
} from "@/src/application/policies/audio-input";
import { type StagedAudioReference } from "@/src/application/contracts/staged-audio";
import { InvalidAudio } from "@/src/application/errors";
import type { StagedAudioStore } from "@/src/application/ports/services";
import type { UserId } from "@/src/domain/user";
import {
  ValidatedStagedAudioPath,
  validateStagedAudioPathname,
} from "@/src/application/policies/staged-audio-path";

// Used to validate that etags don't contain unexpected characters
const OPAQUE_ETAG_CHARACTERS = /^[\x21-\x7e]+$/;

// Option interfaces for vercel blob operations
interface HeadOptions {
  readonly storeId: string;
}

interface GetOptions extends HeadOptions {
  readonly access: "private";
  readonly useCache: false;
}

interface DeleteOptions extends HeadOptions {
  readonly ifMatch: string;
}

// Metadata of file retrieved from vercel blob
// Will be cross-referenced with the expected file metadata
export interface StagedAudioBlobMetadata {
  readonly pathname: unknown;
  readonly etag: unknown;
  readonly size: unknown;
  readonly contentType: unknown;
}

// Complete return type of vercelBlobGet
export interface PrivateBlobGetResult {
  readonly statusCode: number;
  readonly stream: ReadableStream<Uint8Array> | null;
  readonly blob: StagedAudioBlobMetadata;
}

// Return type after cross-reference validation
interface ValidatedStagedAudioMetadata {
  readonly size: number;
  readonly contentType: AllowedAudioContentType;
}

// Return type after validation of incoming audio reference
interface ValidatedStagedAudioReference extends ValidatedStagedAudioPath {
  readonly etag: string;
}

// The narrow slice of @vercel/blob used by this adapter
export interface PrivateBlobClient {
  head(
    pathname: string,
    options: HeadOptions,
  ): Promise<StagedAudioBlobMetadata>;
  get(
    pathname: string,
    options: GetOptions,
  ): Promise<PrivateBlobGetResult | null>;
  del(pathname: string, options: DeleteOptions): Promise<void>;
}

const defaultBlobClient: PrivateBlobClient = {
  head: vercelBlobHead,
  get: vercelBlobGet,
  del: vercelBlobDelete,
};

// Resolves audio from private Vercel Blob store.
export class VercelBlobStagedAudioStore implements StagedAudioStore {
  private readonly storeId: string;

  constructor(
    storeId: string,
    private readonly client: PrivateBlobClient = defaultBlobClient,
  ) {
    // Valid storeId
    if (storeId.length === 0 || storeId !== storeId.trim()) {
      throw new TypeError("A Vercel Blob store ID is required");
    }
    this.storeId = storeId;
  }

  async resolve(
    userId: UserId,
    reference: StagedAudioReference,
  ): Promise<AudioSample> {
    const expected = validateStagedAudioReference(userId, reference);

    // Fetch only the header data of the blob
    let headMetadata: StagedAudioBlobMetadata;
    try {
      headMetadata = await this.client.head(expected.pathname, {
        storeId: this.storeId,
      });
    } catch (error) {
      if (error instanceof BlobNotFoundError) {
        throw new InvalidAudio("Staged audio was not found", { cause: error });
      }
      throw error;
    }

    const initial = validateStagedAudioMetadata(expected, headMetadata);

    return new AudioSample({
      sizeBytes: initial.size,
      filename: expected.basename,
      mediaType: initial.contentType,
      // Function to actually read the audio file
      openStream: async () => {
        const result = await this.client.get(expected.pathname, {
          access: "private",
          useCache: false,
          storeId: this.storeId,
        });
        // Ensure audio was found
        if (result === null || result.statusCode !== 200 || !result.stream) {
          throw new InvalidAudio("Staged audio was not found");
        }

        // Ensure that the retrieved file still matches what was expected
        const current = validateStagedAudioMetadata(expected, result.blob);
        if (
          current.size !== initial.size ||
          current.contentType !== initial.contentType
        ) {
          throw new InvalidAudio("Staged audio metadata changed");
        }
        return result.stream;
      },
    });
  }

  async delete(userId: UserId, reference: StagedAudioReference): Promise<void> {
    const expected = validateStagedAudioReference(userId, reference);
    await this.client.del(expected.pathname, {
      ifMatch: expected.etag,
      storeId: this.storeId,
    });
  }
}

// Ensures a valid incoming audio reference
function validateStagedAudioReference(
  userId: UserId,
  reference: StagedAudioReference,
): ValidatedStagedAudioReference {
  return {
    // Recheck for user ownership
    ...validateStagedAudioPathname(userId, reference.pathname),
    etag: validateStagedAudioEtag(reference.etag),
  };
}

// Make sure etag does not contain unexpected characters
function validateStagedAudioEtag(etag: string): string {
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

// Validates what the client claims to have uploaded (expected)
// against the retrieved metadata from the blob (metadata)
function validateStagedAudioMetadata(
  expected: ValidatedStagedAudioReference,
  metadata: StagedAudioBlobMetadata,
): ValidatedStagedAudioMetadata {
  if (metadata.pathname !== expected.pathname) {
    throw new InvalidAudio("Staged audio pathname changed");
  }
  if (metadata.etag !== expected.etag) {
    throw new InvalidAudio("Staged audio ETag changed");
  }
  if (
    typeof metadata.size !== "number" ||
    !Number.isSafeInteger(metadata.size) ||
    metadata.size <= 0 ||
    metadata.size > MAX_AUDIO_INPUT_BYTES
  ) {
    throw new InvalidAudio("Invalid staged audio size");
  }
  if (
    typeof metadata.contentType !== "string" ||
    !isAllowedAudioContentType(metadata.contentType) ||
    !isAudioContentTypeAllowedForExtension(
      expected.extension,
      metadata.contentType,
    )
  ) {
    throw new InvalidAudio("Invalid staged audio content type");
  }

  return {
    size: metadata.size,
    contentType: metadata.contentType,
  };
}
