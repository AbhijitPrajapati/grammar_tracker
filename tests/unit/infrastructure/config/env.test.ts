import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  getServerEnvironment,
  resetServerEnvironmentForTests,
} from "@/src/infrastructure/config/env";

const ENVIRONMENT_KEYS = [
  "DATABASE_URL",
  "DATABASE_POOL_MAX",
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_TIMEOUT_MS",
  "OPENAI_MAX_RETRIES",
  "JWT_SECRET",
  "SESSION_TTL_MINUTES",
  "ANALYSIS_MINUTE_LIMIT",
  "ANALYSIS_DAY_LIMIT",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "BLOB_STORE_ID",
  "BLOB_WEBHOOK_PUBLIC_KEY",
  "CRON_SECRET",
  "ANALYZER_MODE",
  "LOG_LEVEL",
  "VERCEL_ENV",
] as const;

const originalEnvironment = new Map(
  ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]),
);

function clearEnvironment(): void {
  for (const key of ENVIRONMENT_KEYS) delete process.env[key];
}

function setBaseEnvironment(): void {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://grammar_tracker:password@db.test/grammar_tracker",
    JWT_SECRET: "test-jwt-secret",
    ANALYZER_MODE: "deterministic",
    UPSTASH_REDIS_REST_URL: "https://redis.test",
    UPSTASH_REDIS_REST_TOKEN: "redis-token",
    BLOB_STORE_ID: "store_test",
    BLOB_WEBHOOK_PUBLIC_KEY: "test-webhook-public-key",
    CRON_SECRET: "cron-secret",
  });
}

function setProductionEnvironment(): void {
  Object.assign(process.env, {
    VERCEL_ENV: "production",
    ANALYZER_MODE: "openai",
    OPENAI_API_KEY: "test-openai-key",
  });
}

function reparseEnvironment() {
  resetServerEnvironmentForTests();
  return getServerEnvironment();
}

beforeEach(() => {
  resetServerEnvironmentForTests();
  clearEnvironment();
  setBaseEnvironment();
});

afterAll(() => {
  resetServerEnvironmentForTests();
  clearEnvironment();
  for (const [key, value] of originalEnvironment) {
    if (value !== undefined) process.env[key] = value;
  }
});

describe("server environment", () => {
  it("uses the fixed deployed models and exact quota defaults", () => {
    const environment = reparseEnvironment();

    expect(environment).toMatchObject({
      databaseUrl:
        "postgresql://grammar_tracker:password@db.test/grammar_tracker",
      databasePoolMax: 10,
      openAiAnalysisModel: "o4-mini",
      openAiTranscriptionModel: "gpt-4o-mini-transcribe",
      openAiTimeoutMs: 60_000,
      openAiMaxRetries: 1,
      sessionTtlMinutes: 60,
      analysisMinuteLimit: 3,
      analysisDayLimit: 20,
      analyzerMode: "deterministic",
      isVercelProduction: false,
    });
  });

  it("requires an API key for the real analyzer", () => {
    process.env.ANALYZER_MODE = "openai";
    expect(() => reparseEnvironment()).toThrow(
      "OPENAI_API_KEY is required when ANALYZER_MODE=openai",
    );

    process.env.OPENAI_API_KEY = "openai-key";
    expect(reparseEnvironment().openAiApiKey).toBe("openai-key");
  });

  it.each([
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "BLOB_STORE_ID",
    "BLOB_WEBHOOK_PUBLIC_KEY",
    "CRON_SECRET",
  ] as const)("requires %s on the application's single deployment path", (key) => {
    delete process.env[key];
    expect(() => reparseEnvironment()).toThrow();
  });

  it("forbids the deterministic fixture in Vercel production", () => {
    setProductionEnvironment();
    expect(reparseEnvironment().isVercelProduction).toBe(true);

    process.env.ANALYZER_MODE = "deterministic";
    expect(() => reparseEnvironment()).toThrow(
      "deterministic analyzer is forbidden in production",
    );
  });

  it("rejects legacy driver URLs and invalid numeric settings", () => {
    process.env.DATABASE_URL =
      "postgresql+asyncpg://grammar_tracker:password@db.test/grammar_tracker";
    expect(() => reparseEnvironment()).toThrow();

    process.env.DATABASE_URL =
      "postgresql://grammar_tracker:password@db.test/grammar_tracker";
    process.env.ANALYSIS_MINUTE_LIMIT = "0";
    expect(() => reparseEnvironment()).toThrow();

    process.env.ANALYSIS_MINUTE_LIMIT = "3";
    process.env.OPENAI_MAX_RETRIES = "6";
    expect(() => reparseEnvironment()).toThrow();
  });

  it("keeps both sequential OpenAI operations within Vercel's duration", () => {
    process.env.OPENAI_TIMEOUT_MS = "70000";
    process.env.OPENAI_MAX_RETRIES = "1";
    expect(reparseEnvironment().openAiTimeoutMs).toBe(70_000);

    process.env.OPENAI_TIMEOUT_MS = "70001";
    expect(() => reparseEnvironment()).toThrow(
      "combined OpenAI timeout/retry budget must fit",
    );

    process.env.OPENAI_TIMEOUT_MS = "120000";
    process.env.OPENAI_MAX_RETRIES = "0";
    expect(reparseEnvironment().openAiTimeoutMs).toBe(120_000);
  });
});
