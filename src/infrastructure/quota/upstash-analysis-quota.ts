import { randomUUID } from "node:crypto";

import type { Redis } from "@upstash/redis";

import type { AnalysisQuota } from "@/src/application/ports/services";
import type { UserId } from "@/src/domain/user";

const MINUTE_WINDOW_MS = 60_000;
const DAY_WINDOW_MS = 86_400_000;
const KEY_PREFIX = "grammar-tracker:analysis-quota";

// Need extra millisecond because an attempt exactly
// one day old is still inside the rolling window.
const QUOTA_KEY_TTL_MS = DAY_WINDOW_MS + 1;

export interface UpstashAnalysisQuotaOptions {
  readonly minuteLimit: number;
  readonly dayLimit: number;
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

// Uses Lua script to ensure atomicity
// Calculates boundaries based on day and minute windows
// Removes entries that lie before day boundary
// Counts attempts within each window
// Adds only successful quota consumption
const UPSTASH_ANALYSIS_QUOTA_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local minute_limit = tonumber(ARGV[2])
local day_limit = tonumber(ARGV[3])
local member = ARGV[4]

local minute_boundary = now - ${MINUTE_WINDOW_MS}
local day_boundary = now - ${DAY_WINDOW_MS}

redis.call("ZREMRANGEBYSCORE", key, "-inf", "(" .. day_boundary)

local minute_count = redis.call("ZCOUNT", key, minute_boundary, "+inf")
local day_count = redis.call("ZCARD", key)

if minute_count >= minute_limit or day_count >= day_limit then
  return 0
end

redis.call("ZADD", key, now, member)
redis.call("PEXPIRE", key, ${QUOTA_KEY_TTL_MS})
return 1
`;

export class UpstashAnalysisQuota implements AnalysisQuota {
  private readonly script: ReturnType<Redis["createScript"]>;
  private readonly minuteLimit: number;
  private readonly dayLimit: number;

  constructor(redis: Redis, options: UpstashAnalysisQuotaOptions) {
    assertPositiveInteger("minuteLimit", options.minuteLimit);
    assertPositiveInteger("dayLimit", options.dayLimit);

    this.minuteLimit = options.minuteLimit;
    this.dayLimit = options.dayLimit;
    this.script = redis.createScript<number>(UPSTASH_ANALYSIS_QUOTA_SCRIPT);
  }

  async tryConsume(userId: UserId): Promise<boolean> {
    const now = Date.now();
    const member = `${now}:${randomUUID()}`;
    const result = await this.script.exec(
      [`${KEY_PREFIX}:${userId}`],
      [String(now), String(this.minuteLimit), String(this.dayLimit), member],
    );

    if (result !== 0 && result !== 1) {
      throw new TypeError(
        `Unexpected analysis quota result: ${String(result)}`,
      );
    }
    return result === 1;
  }
}
