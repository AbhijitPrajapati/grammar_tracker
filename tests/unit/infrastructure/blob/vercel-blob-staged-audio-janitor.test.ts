import { beforeEach, describe, expect, it, vi } from "vitest";

import { VercelBlobStagedAudioJanitor } from "@/src/infrastructure/blob";

const NOW = new Date("2026-09-02T18:00:00.000Z");

const doubles = vi.hoisted(() => {
  class BlobNotFoundError extends Error {}
  class BlobPreconditionFailedError extends Error {}
  return {
    BlobNotFoundError,
    BlobPreconditionFailedError,
    list: vi.fn(),
    del: vi.fn(),
  };
});

vi.mock("@vercel/blob", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vercel/blob")>()),
  BlobNotFoundError: doubles.BlobNotFoundError,
  BlobPreconditionFailedError: doubles.BlobPreconditionFailedError,
  list: doubles.list,
  del: doubles.del,
}));

function blob(pathname: string, ageHours: number, etag: string) {
  return {
    pathname,
    etag,
    uploadedAt: new Date(NOW.getTime() - ageHours * 60 * 60 * 1_000),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VercelBlobStagedAudioJanitor", () => {
  it("paginates the staging prefix and conditionally deletes expired blobs", async () => {
    doubles.list
      .mockResolvedValueOnce({
        blobs: [
          blob("speech-staging/user/audio.webm", 25, "etag-old"),
          blob("speech-staging/user/audio.wav", 23, "etag-fresh"),
          blob("speech-staging/race/audio.mp3", 48, "etag-stale"),
        ],
        hasMore: true,
        cursor: "next-page",
      })
      .mockResolvedValueOnce({
        blobs: [blob("speech-staging/other/audio.ogg", 72, "etag-other")],
        hasMore: false,
      });
    doubles.del.mockImplementation(async (pathname: string) => {
      if (pathname.includes("/race/")) {
        throw new doubles.BlobPreconditionFailedError();
      }
    });

    const janitor = new VercelBlobStagedAudioJanitor("store_test");
    const result = await janitor.deleteUploadedBefore(
      new Date(NOW.getTime() - 24 * 60 * 60 * 1_000),
    );

    expect(result).toEqual({ inspected: 4, deleted: 2 });
    expect(doubles.list).toHaveBeenNthCalledWith(1, {
      storeId: "store_test",
      prefix: "speech-staging/",
      cursor: undefined,
      limit: 1_000,
    });
    expect(doubles.list).toHaveBeenNthCalledWith(2, {
      storeId: "store_test",
      prefix: "speech-staging/",
      cursor: "next-page",
      limit: 1_000,
    });
    expect(doubles.del).toHaveBeenCalledTimes(3);
    expect(doubles.del).not.toHaveBeenCalledWith(
      "speech-staging/user/audio.wav",
      expect.anything(),
    );
  });
});
