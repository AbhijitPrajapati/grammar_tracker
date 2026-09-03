import "server-only";

import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  del,
  list,
  type ListBlobResultBlob,
} from "@vercel/blob";

import { STAGED_AUDIO_ROOT } from "@/src/application/contracts/staged-audio";
import type {
  StagedAudioCleanupSummary,
  StagedAudioJanitor,
} from "@/src/application/ports/services";

const DELETE_CONCURRENCY = 25;

export class VercelBlobStagedAudioJanitor implements StagedAudioJanitor {
  constructor(private readonly storeId: string) {}

  async deleteUploadedBefore(cutoff: Date): Promise<StagedAudioCleanupSummary> {
    let cursor: string | undefined;
    let inspected = 0;
    let deleted = 0;

    do {
      const page = await list({
        storeId: this.storeId,
        prefix: `${STAGED_AUDIO_ROOT}/`,
        cursor,
        limit: 1_000,
      });
      inspected += page.blobs.length;

      const expired = page.blobs.filter((blob) => blob.uploadedAt < cutoff);
      for (let index = 0; index < expired.length; index += DELETE_CONCURRENCY) {
        const batch = expired.slice(index, index + DELETE_CONCURRENCY);
        const removed = await Promise.all(
          batch.map((blob) => this.deleteIfUnchanged(blob)),
        );
        deleted += removed.filter(Boolean).length;
      }

      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    return { inspected, deleted };
  }

  private async deleteIfUnchanged(
    blob: ListBlobResultBlob,
  ): Promise<boolean> {
    try {
      await del(blob.pathname, {
        storeId: this.storeId,
        ifMatch: blob.etag,
      });
      return true;
    } catch (error) {
      if (
        error instanceof BlobNotFoundError ||
        error instanceof BlobPreconditionFailedError
      ) {
        return false;
      }
      throw error;
    }
  }
}
