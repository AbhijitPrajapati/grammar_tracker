import {
  APIConnectionError,
  BadRequestError,
  RateLimitError,
} from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OpenAiClient } from "@/src/adapters/outbound/openai/client";
import { AnalysisQuotaExhausted } from "@/src/core/application/errors";

const logger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/src/adapters/outbound/observability/logger", () => ({
  getLogger: () => logger,
}));

function client(maxRetries: number): OpenAiClient {
  return new OpenAiClient({
    apiKey: "test-key",
    baseUrl: "https://openai.test/v1",
    timeoutMs: 1_000,
    maxRetries,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("OpenAiClient", () => {
  it("returns response data and records the provider request ID", async () => {
    const request = vi.fn(async () => ({ data: "transcript", requestId: "req_1" }));

    await expect(client(0).execute("transcription", request)).resolves.toBe(
      "transcript",
    );
    expect(request).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "transcription",
        openAiRequestId: "req_1",
        attempt: 1,
      }),
      "OpenAI operation completed",
    );
  });

  it("retries a connection failure by invoking the whole operation again", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const request = vi
      .fn<() => Promise<{ data: string; requestId: string | null }>>()
      .mockRejectedValueOnce(new APIConnectionError({ message: "offline" }))
      .mockResolvedValueOnce({ data: "recovered", requestId: null });

    const pending = client(1).execute("grammar_analysis", request);
    await vi.advanceTimersByTimeAsync(250);

    await expect(pending).resolves.toBe("recovered");
    expect(request).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ willRetry: true, attempt: 1 }),
      "OpenAI operation failed",
    );
  });

  it("does not retry non-retryable API errors", async () => {
    const error = new BadRequestError(
      400,
      { message: "invalid request" },
      undefined,
      new Headers(),
    );
    const request = vi.fn(async () => Promise.reject(error));

    await expect(
      client(3).execute("grammar_analysis", request),
    ).rejects.toBe(error);
    expect(request).toHaveBeenCalledOnce();
  });

  it("translates a final provider 429 into the application adapter signal", async () => {
    const rateLimit = new RateLimitError(
      429,
      { message: "quota exhausted" },
      undefined,
      new Headers({ "x-request-id": "req_limited" }),
    );

    const caught = await client(0)
      .execute("transcription", async () => Promise.reject(rateLimit))
      .catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(AnalysisQuotaExhausted);
    expect((caught as Error).cause).toBe(rateLimit);
  });
});
