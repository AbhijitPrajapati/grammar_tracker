import "server-only";

import OpenAI, {
  APIConnectionError,
  APIError,
  RateLimitError,
} from "openai";

import { AnalysisQuotaExhausted } from "@/src/application/errors";
import { getLogger } from "../observability/logger";

export interface OpenAiClientOptions {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
}

export interface OpenAiOperationResult<T> {
  readonly data: T;
  readonly requestId: string | null;
}

export class OpenAiClient {
  readonly sdk: OpenAI;
  readonly maxRetries: number;

  constructor(options: OpenAiClientOptions) {
    this.sdk = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseUrl,
      timeout: options.timeoutMs,
      // Streams must be reopened for a retry, so adapters own retry behavior.
      maxRetries: 0,
    });
    this.maxRetries = options.maxRetries;
  }

  async execute<T>(
    operation: "transcription" | "grammar_analysis",
    request: () => Promise<OpenAiOperationResult<T>>,
  ): Promise<T> {
    const startedAt = Date.now();
    let attempt = 0;

    for (;;) {
      try {
        const result = await request();
        getLogger().info(
          {
            operation,
            openAiRequestId: result.requestId,
            attempt: attempt + 1,
            durationMs: Date.now() - startedAt,
          },
          "OpenAI operation completed",
        );
        return result.data;
      } catch (error) {
        const mayRetry = isRetryable(error) && attempt < this.maxRetries;
        getLogger()[mayRetry ? "warn" : "error"](
          {
            operation,
            attempt: attempt + 1,
            durationMs: Date.now() - startedAt,
            errorType: error instanceof Error ? error.name : "UnknownError",
            status: error instanceof APIError ? error.status : undefined,
            willRetry: mayRetry,
          },
          "OpenAI operation failed",
        );

        if (!mayRetry) {
          if (error instanceof RateLimitError) {
            throw new AnalysisQuotaExhausted(undefined, { cause: error });
          }
          throw error;
        }

        await wait(250 * 2 ** attempt + Math.floor(Math.random() * 100));
        attempt += 1;
      }
    }
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof APIConnectionError) return true;
  return (
    error instanceof APIError &&
    (error.status === 408 ||
      error.status === 409 ||
      error.status === 429 ||
      (typeof error.status === "number" && error.status >= 500))
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
