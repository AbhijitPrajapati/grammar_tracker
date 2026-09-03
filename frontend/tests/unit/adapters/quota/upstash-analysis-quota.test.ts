import type { Redis } from "@upstash/redis";
import { describe, expect, it, vi } from "vitest";

import {
  DAY_WINDOW_MS,
  QUOTA_KEY_TTL_MS,
  UPSTASH_ANALYSIS_QUOTA_SCRIPT,
  UpstashAnalysisQuota,
} from "@/src/adapters/outbound/quota";

const USER_ID = "4fcd2c4d-c90b-4202-8b1f-f59cf95cced6";

interface ScriptCall {
  readonly keys: string[];
  readonly args: string[];
}

function redisDouble(results: unknown[]) {
  const calls: ScriptCall[] = [];
  const exec = vi.fn(async (keys: string[], args: string[]) => {
    calls.push({ keys, args });
    return results.shift();
  });
  const createScript = vi.fn(() => ({ exec }));

  return {
    redis: { createScript } as unknown as Redis,
    calls,
    createScript,
    exec,
  };
}

describe("UpstashAnalysisQuota", () => {
  it("executes one script with the per-user key and configured limits", async () => {
    const fake = redisDouble([1]);
    const quota = new UpstashAnalysisQuota(fake.redis, {
      minuteLimit: 3,
      dayLimit: 20,
      clock: () => 1_234,
      keyPrefix: "test:quota",
      uniqueId: () => "request-one",
    });

    await expect(quota.tryConsume(USER_ID)).resolves.toBe(true);
    expect(fake.createScript).toHaveBeenCalledOnce();
    expect(fake.exec).toHaveBeenCalledOnce();
    expect(fake.calls).toEqual([
      {
        keys: [`test:quota:${USER_ID}`],
        args: ["1234", "3", "20", "1234:request-one"],
      },
    ]);
  });

  it("maps a rejected atomic result without issuing another operation", async () => {
    const fake = redisDouble([0]);
    const quota = new UpstashAnalysisQuota(fake.redis, {
      minuteLimit: 3,
      dayLimit: 20,
    });

    await expect(quota.tryConsume(USER_ID)).resolves.toBe(false);
    expect(fake.exec).toHaveBeenCalledOnce();
  });

  it("uses distinct members for attempts occurring in the same millisecond", async () => {
    const fake = redisDouble([1, 1]);
    let sequence = 0;
    const quota = new UpstashAnalysisQuota(fake.redis, {
      minuteLimit: 3,
      dayLimit: 20,
      clock: () => 5_000,
      uniqueId: () => `request-${++sequence}`,
    });

    await Promise.all([quota.tryConsume(USER_ID), quota.tryConsume(USER_ID)]);

    expect(fake.calls.map(({ args }) => args[3])).toEqual([
      "5000:request-1",
      "5000:request-2",
    ]);
  });

  it("keeps exact lower-boundary timestamps and bounds the key lifetime", () => {
    expect(UPSTASH_ANALYSIS_QUOTA_SCRIPT).toContain(
      '"ZREMRANGEBYSCORE", key, "-inf", "(" .. day_boundary',
    );
    expect(UPSTASH_ANALYSIS_QUOTA_SCRIPT).toContain(
      '"ZCOUNT", key, minute_boundary, "+inf"',
    );
    expect(
      UPSTASH_ANALYSIS_QUOTA_SCRIPT.indexOf('redis.call("ZADD"'),
    ).toBeGreaterThan(
      UPSTASH_ANALYSIS_QUOTA_SCRIPT.indexOf("if minute_count >= minute_limit"),
    );
    expect(QUOTA_KEY_TTL_MS).toBe(DAY_WINDOW_MS + 1);
    expect(UPSTASH_ANALYSIS_QUOTA_SCRIPT).toContain(
      `redis.call("PEXPIRE", key, ${DAY_WINDOW_MS + 1})`,
    );
  });

  it("fails closed on an unexpected script response", async () => {
    const fake = redisDouble(["1"]);
    const quota = new UpstashAnalysisQuota(fake.redis, {
      minuteLimit: 3,
      dayLimit: 20,
    });

    await expect(quota.tryConsume(USER_ID)).rejects.toThrow(
      "Unexpected analysis quota result",
    );
  });
});
