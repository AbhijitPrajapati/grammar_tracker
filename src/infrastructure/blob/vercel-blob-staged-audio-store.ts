import "server-only";

import {
  BlobNotFoundError,
  del as vercelBlobDelete,
  get as vercelBlobGet,
  head as vercelBlobHead,
} from "@vercel/blob";

import { AudioSample } from "@/src/application/contracts/audio";
import type { StagedAudioReference } from "@/src/application/contracts/staged-audio";
import { validateStagedAudioPathname } from "@/src/application/contracts/staged-audio";
import { InvalidAudio } from "@/src/application/errors";
import type { StagedAudioStore } from "@/src/application/ports/services";
import type { UserId } from "@/src/domain/user";
import {
  validateStagedAudioEtag,
  validateStagedAudioMetadata,
  type StagedAudioBlobMetadata,
} from "./staged-audio-metadata";

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

export interface PrivateBlobGetResult {
  readonly statusCode: number;
  readonly stream: ReadableStream<Uint8Array> | null;
  readonly blob: StagedAudioBlobMetadata;
}

/** The narrow slice of @vercel/blob used by this adapter. */
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

/**
 * Resolves user-owned audio from an OIDC-connected private Vercel Blob store.
 * No read/write token or Blob URL is accepted by this adapter.
 */
export class VercelBlobStagedAudioStore implements StagedAudioStore {
  private readonly storeId: string;

  constructor(
    storeId: string,
    private readonly client: PrivateBlobClient = defaultBlobClient,
  ) {
    if (storeId.length === 0 || storeId !== storeId.trim()) {
      throw new TypeError("A Vercel Blob store ID is required");
    }
    this.storeId = storeId;
  }

  async resolve(
    userId: UserId,
    reference: StagedAudioReference,
  ): Promise<AudioSample> {
    const pathname = validateStagedAudioPathname(
      userId,
      reference.pathname,
    ).pathname;
    const etag = validateStagedAudioEtag(reference.etag);

    let headMetadata: StagedAudioBlobMetadata;
    try {
      headMetadata = await this.client.head(pathname, {
        storeId: this.storeId,
      });
    } catch (error) {
      if (error instanceof BlobNotFoundError) {
        throw new InvalidAudio("Staged audio was not found", { cause: error });
      }
      throw error;
    }

    const validated = validateStagedAudioMetadata(
      userId,
      pathname,
      etag,
      headMetadata,
    );

    return new AudioSample({
      sizeBytes: validated.size,
      filename: validated.basename,
      mediaType: validated.contentType,
      openStream: async () => {
        const result = await this.client.get(pathname, {
          access: "private",
          useCache: false,
          storeId: this.storeId,
        });
        if (result === null || result.statusCode !== 200 || !result.stream) {
          throw new InvalidAudio("Staged audio was not found");
        }

        const current = validateStagedAudioMetadata(
          userId,
          pathname,
          etag,
          result.blob,
        );
        if (
          current.size !== validated.size ||
          current.contentType !== validated.contentType
        ) {
          throw new InvalidAudio("Staged audio metadata changed");
        }
        return result.stream;
      },
    });
  }

  async delete(userId: UserId, reference: StagedAudioReference): Promise<void> {
    const pathname = validateStagedAudioPathname(
      userId,
      reference.pathname,
    ).pathname;
    const etag = validateStagedAudioEtag(reference.etag);
    await this.client.del(pathname, {
      ifMatch: etag,
      storeId: this.storeId,
    });
  }
}
