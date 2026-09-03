import { timingSafeEqual } from "node:crypto";

import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  del,
  list,
  type ListBlobResultBlob,
} from "@vercel/blob";
import { NextResponse } from "next/server";

import { STAGED_AUDIO_ROOT } from "@/src/adapters/outbound/blob";
import { getServerEnvironment } from "@/src/adapters/outbound/config/env";
import { getLogger } from "@/src/adapters/outbound/observability/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

const ORPHAN_AGE_MS = 24 * 60 * 60 * 1_000;
const DELETE_CONCURRENCY = 25;

export async function GET(request: Request): Promise<Response> {
  const environment = getServerEnvironment();
  if (
    !hasValidCronAuthorization(
      request.headers.get("authorization"),
      environment.cronSecret,
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const storeId = environment.blobStoreId;

  const cutoff = Date.now() - ORPHAN_AGE_MS;
  let cursor: string | undefined;
  let inspected = 0;
  let deleted = 0;

  do {
    const page = await list({
      storeId,
      prefix: `${STAGED_AUDIO_ROOT}/`,
      cursor,
      limit: 1_000,
    });
    inspected += page.blobs.length;

    const orphans = page.blobs.filter(
      (blob) => blob.uploadedAt.getTime() < cutoff,
    );
    for (let index = 0; index < orphans.length; index += DELETE_CONCURRENCY) {
      const batch = orphans.slice(index, index + DELETE_CONCURRENCY);
      const removed = await Promise.all(
        batch.map((blob) => deleteUnchangedBlob(blob, storeId)),
      );
      deleted += removed.filter(Boolean).length;
    }

    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  getLogger().info(
    { operation: "cleanup_staged_audio", inspected, deleted },
    "Staged audio cleanup completed",
  );
  return NextResponse.json({ inspected, deleted });
}

async function deleteUnchangedBlob(
  blob: ListBlobResultBlob,
  storeId: string,
): Promise<boolean> {
  try {
    await del(blob.pathname, { storeId, ifMatch: blob.etag });
    return true;
  } catch (error) {
    // Resolution/action cleanup can race the orphan sweep. A changed object
    // must never be removed using stale list metadata.
    if (
      error instanceof BlobNotFoundError ||
      error instanceof BlobPreconditionFailedError
    ) {
      return false;
    }
    throw error;
  }
}

export function hasValidCronAuthorization(
  authorization: string | null,
  secret: string,
): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}
