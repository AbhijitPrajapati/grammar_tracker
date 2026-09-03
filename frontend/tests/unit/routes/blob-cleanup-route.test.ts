import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GET,
  hasValidCronAuthorization,
} from "@/app/api/cron/blob-cleanup/route";

const NOW = new Date("2026-09-02T18:00:00.000Z");

const doubles = vi.hoisted(() => {
  class BlobNotFoundError extends Error {}
  class BlobPreconditionFailedError extends Error {}
  return {
    BlobNotFoundError,
    BlobPreconditionFailedError,
    list: vi.fn(),
    del: vi.fn(),
    getServerEnvironment: vi.fn(),
    info: vi.fn(),
  };
});

vi.mock("@vercel/blob", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vercel/blob")>()),
  BlobNotFoundError: doubles.BlobNotFoundError,
  BlobPreconditionFailedError: doubles.BlobPreconditionFailedError,
  list: doubles.list,
  del: doubles.del,
}));

vi.mock("@/src/adapters/outbound/config/env", () => ({
  getServerEnvironment: doubles.getServerEnvironment,
}));

vi.mock("@/src/adapters/outbound/observability/logger", () => ({
  getLogger: () => ({ info: doubles.info }),
}));

function request(authorization?: string): Request {
  return new Request("https://grammar.test/api/cron/blob-cleanup", {
    headers: authorization === undefined ? {} : { authorization },
  });
}

function blob(pathname: string, ageHours: number, etag: string) {
  return {
    pathname,
    etag,
    uploadedAt: new Date(NOW.getTime() - ageHours * 60 * 60 * 1_000),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  doubles.list.mockReset();
  doubles.del.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  doubles.getServerEnvironment.mockReturnValue({
    cronSecret: "cron-secret",
    blobStoreId: "store_test",
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Blob orphan cleanup route", () => {
  it("rejects missing, malformed, and inexact bearer credentials", async () => {
    for (const authorization of [
      undefined,
      "cron-secret",
      "Basic cron-secret",
      "Bearer cron-secret-extra",
    ]) {
      const response = await GET(request(authorization));
      expect(response.status).toBe(401);
    }

    expect(doubles.list).not.toHaveBeenCalled();
  });

  it("paginates only the staging prefix and conditionally deletes old blobs", async () => {
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
        cursor: undefined,
      });
    doubles.del.mockImplementation(async (pathname: string) => {
      if (pathname.includes("/race/")) {
        throw new doubles.BlobPreconditionFailedError();
      }
    });

    const response = await GET(request("Bearer cron-secret"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ inspected: 4, deleted: 2 });
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
    expect(doubles.del).toHaveBeenCalledWith(
      "speech-staging/user/audio.webm",
      { storeId: "store_test", ifMatch: "etag-old" },
    );
    expect(doubles.del).not.toHaveBeenCalledWith(
      "speech-staging/user/audio.wav",
      expect.anything(),
    );
    expect(doubles.info).toHaveBeenCalledWith(
      { operation: "cleanup_staged_audio", inspected: 4, deleted: 2 },
      "Staged audio cleanup completed",
    );
  });

  it("compares the complete bearer value, including multibyte secrets", () => {
    expect(hasValidCronAuthorization("Bearer exact-secret", "exact-secret")).toBe(
      true,
    );
    expect(hasValidCronAuthorization("Bearer exact-secreT", "exact-secret")).toBe(
      false,
    );
    expect(hasValidCronAuthorization("Bearer 🔐-secret", "🔐-secret")).toBe(
      true,
    );
    expect(hasValidCronAuthorization(null, "exact-secret")).toBe(false);
  });
});
