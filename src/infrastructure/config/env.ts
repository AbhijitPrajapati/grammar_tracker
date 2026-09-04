import "server-only";

import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const positiveInteger = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);

const serverEnvironmentSchema = z.object({
  DATABASE_URL: z
    .string()
    .regex(/^postgres(?:ql)?:\/\//, "DATABASE_URL must be a PostgreSQL URL"),
  DATABASE_POOL_MAX: positiveInteger(10),

  OPENAI_API_KEY: optionalNonEmptyString,
  OPENAI_BASE_URL: z.url().default("https://api.openai.com/v1"),
  OPENAI_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(120_000)
    .default(60_000),
  OPENAI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(1),

  JWT_SECRET: z.string().min(1),
  SESSION_TTL_MINUTES: positiveInteger(60),

  ANALYSIS_MINUTE_LIMIT: positiveInteger(3),
  ANALYSIS_DAY_LIMIT: positiveInteger(20),
  UPSTASH_REDIS_REST_URL: z.string().min(1),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  BLOB_STORE_ID: z.string().min(1),
  BLOB_WEBHOOK_PUBLIC_KEY: z.string().min(1),

  ANALYZER_MODE: z.enum(["openai", "deterministic"]).default("openai"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
});

type ServerEnvironment = ReturnType<typeof parseServerEnvironment>;

let cachedEnvironment: ServerEnvironment | undefined;

export function getServerEnvironment(): ServerEnvironment {
  cachedEnvironment ??= parseServerEnvironment(process.env);
  return cachedEnvironment;
}

export function resetServerEnvironmentForTests(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Environment cache may only be reset while testing");
  }
  cachedEnvironment = undefined;
}

function parseServerEnvironment(source: NodeJS.ProcessEnv) {
  const parsed = serverEnvironmentSchema.parse(source);
  const isVercelProduction = parsed.VERCEL_ENV === "production";

  if (parsed.ANALYZER_MODE === "openai" && !parsed.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when ANALYZER_MODE=openai");
  }
  if (isVercelProduction && parsed.ANALYZER_MODE !== "openai") {
    throw new Error("The deterministic analyzer is forbidden in production");
  }
  if (
    parsed.OPENAI_TIMEOUT_MS * (parsed.OPENAI_MAX_RETRIES + 1) * 2 >
    280_000
  ) {
    throw new Error(
      "The combined OpenAI timeout/retry budget must fit the 300-second function duration",
    );
  }
  return {
    databaseUrl: parsed.DATABASE_URL,
    databasePoolMax: parsed.DATABASE_POOL_MAX,
    openAiApiKey: parsed.OPENAI_API_KEY,
    openAiBaseUrl: parsed.OPENAI_BASE_URL,
    openAiAnalysisModel: "o4-mini" as const,
    openAiTranscriptionModel: "gpt-4o-mini-transcribe" as const,
    openAiTimeoutMs: parsed.OPENAI_TIMEOUT_MS,
    openAiMaxRetries: parsed.OPENAI_MAX_RETRIES,
    jwtSecret: parsed.JWT_SECRET,
    sessionTtlMinutes: parsed.SESSION_TTL_MINUTES,
    analysisMinuteLimit: parsed.ANALYSIS_MINUTE_LIMIT,
    analysisDayLimit: parsed.ANALYSIS_DAY_LIMIT,
    upstashRedisRestUrl: parsed.UPSTASH_REDIS_REST_URL,
    upstashRedisRestToken: parsed.UPSTASH_REDIS_REST_TOKEN,
    blobStoreId: parsed.BLOB_STORE_ID,
    blobWebhookPublicKey: parsed.BLOB_WEBHOOK_PUBLIC_KEY,
    analyzerMode: parsed.ANALYZER_MODE,
    logLevel: parsed.LOG_LEVEL,
    isVercelProduction,
  } as const;
}
