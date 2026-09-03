import { randomUUID } from "node:crypto";

import type { Redis } from "@upstash/redis";

import type { AnalysisQuota } from "@/src/application/ports/services";
import type { UserId } from "@/src/domain/user";

import {
  DAY_WINDOW_MS,
  MINUTE_WINDOW_MS,
  QUOTA_KEY_TTL_MS,
  type AnalysisQuotaOptions,
  readTimestamp,
  validateQuotaOptions,
} from "./settings";

export const UPSTASH_ANALYSIS_QUOTA_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local minute_limit = tonumber(ARGV[2])
local day_limit = tonumber(ARGV[3])
local member = ARGV[4]

local minute_boundary = now - ${MINUTE_WINDOW_MS}
local day_boundary = now - ${DAY_WINDOW_MS}

-- An attempt exactly on the lower boundary remains in its rolling window.
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

export interface UpstashAnalysisQuotaOptions extends AnalysisQuotaOptions {
  readonly keyPrefix?: string;
  readonly uniqueId?: () => string;
}

/** Distributed, atomic rolling quota for Vercel production instances. */
export class UpstashAnalysisQuota implements AnalysisQuota {
  private readonly script: ReturnType<Redis["createScript"]>;
  private readonly minuteLimit: number;
  private readonly dayLimit: number;
  private readonly clock: () => number;
  private readonly keyPrefix: string;
  private readonly uniqueId: () => string;

  constructor(redis: Redis, options: UpstashAnalysisQuotaOptions) {
    validateQuotaOptions(options);
    this.minuteLimit = options.minuteLimit;
    this.dayLimit = options.dayLimit;
    this.clock = options.clock ?? Date.now;
    this.keyPrefix = options.keyPrefix ?? "grammar-tracker:analysis-quota";
    this.uniqueId = options.uniqueId ?? randomUUID;
    this.script = redis.createScript<number>(UPSTASH_ANALYSIS_QUOTA_SCRIPT);
  }

  async tryConsume(userId: UserId): Promise<boolean> {
    const now = readTimestamp(this.clock);
    const member = `${now}:${this.uniqueId()}`;
    const result = await this.script.exec(
      [`${this.keyPrefix}:${userId}`],
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
