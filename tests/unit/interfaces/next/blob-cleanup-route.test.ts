import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GET,
  hasValidCronAuthorization,
} from "@/app/api/cron/blob-cleanup/route";

const NOW = new Date("2026-09-02T18:00:00.000Z");

const doubles = vi.hoisted(() => {
  return {
    cleanup: vi.fn(),
    getServerEnvironment: vi.fn(),
    info: vi.fn(),
  };
});

vi.mock("@/src/bootstrap/container", () => ({
  getApplicationContainer: () => ({
    cleanupAbandonedAudio: { execute: doubles.cleanup },
  }),
}));

vi.mock("@/src/infrastructure/config/env", () => ({
  getServerEnvironment: doubles.getServerEnvironment,
}));

vi.mock("@/src/infrastructure/observability/logger", () => ({
  getLogger: () => ({ info: doubles.info }),
}));

function request(authorization?: string): Request {
  return new Request("https://grammar.test/api/cron/blob-cleanup", {
    headers: authorization === undefined ? {} : { authorization },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  doubles.getServerEnvironment.mockReturnValue({
    cronSecret: "cron-secret",
    blobStoreId: "store_test",
  });
  doubles.cleanup.mockResolvedValue({ inspected: 4, deleted: 2 });
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

    expect(doubles.cleanup).not.toHaveBeenCalled();
  });

  it("delegates cleanup after authenticating the scheduler", async () => {
    const response = await GET(request("Bearer cron-secret"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ inspected: 4, deleted: 2 });
    expect(doubles.cleanup).toHaveBeenCalledOnce();
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
