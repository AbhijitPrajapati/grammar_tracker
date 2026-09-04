import type { Redis } from "@upstash/redis";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UpstashAnalysisQuota } from "@/src/infrastructure/quota/upstash-analysis-quota";

const USER_ID = "4fcd2c4d-c90b-4202-8b1f-f59cf95cced6";
const DAY_WINDOW_MS = 86_400_000;

interface ScriptCall {
  readonly keys: string[];
  readonly args: string[];
}

function redisDouble(results: unknown[]) {
  const calls: ScriptCall[] = [];
  const scripts: string[] = [];
  const exec = vi.fn(async (keys: string[], args: string[]) => {
    calls.push({ keys, args });
    return results.shift();
  });
  const createScript = vi.fn((script: string) => {
    scripts.push(script);
    return { exec };
  });

  return {
    redis: { createScript } as unknown as Redis,
    calls,
    scripts,
    createScript,
    exec,
  };
}

describe("UpstashAnalysisQuota", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("executes one script with the per-user key and configured limits", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_234);
    const fake = redisDouble([1]);
    const quota = new UpstashAnalysisQuota(fake.redis, {
      minuteLimit: 3,
      dayLimit: 20,
    });

    await expect(quota.tryConsume(USER_ID)).resolves.toBe(true);
    expect(fake.createScript).toHaveBeenCalledOnce();
    expect(fake.exec).toHaveBeenCalledOnce();
    expect(fake.calls).toEqual([
      {
        keys: [`grammar-tracker:analysis-quota:${USER_ID}`],
        args: ["1234", "3", "20", expect.stringMatching(/^1234:.+/)],
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
    vi.spyOn(Date, "now").mockReturnValue(5_000);
    const fake = redisDouble([1, 1]);
    const quota = new UpstashAnalysisQuota(fake.redis, {
      minuteLimit: 3,
      dayLimit: 20,
    });

    await Promise.all([quota.tryConsume(USER_ID), quota.tryConsume(USER_ID)]);

    const members = fake.calls.map(({ args }) => args[3]);
    expect(members[0]).toMatch(/^5000:.+/);
    expect(members[1]).toMatch(/^5000:.+/);
    expect(members[0]).not.toBe(members[1]);
  });

  it("keeps exact lower-boundary timestamps and bounds the key lifetime", () => {
    const fake = redisDouble([]);
    new UpstashAnalysisQuota(fake.redis, {
      minuteLimit: 3,
      dayLimit: 20,
    });
    const [script] = fake.scripts;
    if (script === undefined) {
      throw new Error("The quota did not create its Redis script");
    }

    expect(script).toContain(
      '"ZREMRANGEBYSCORE", key, "-inf", "(" .. day_boundary',
    );
    expect(script).toContain(
      '"ZCOUNT", key, minute_boundary, "+inf"',
    );
    expect(script.indexOf('redis.call("ZADD"')).toBeGreaterThan(
      script.indexOf("if minute_count >= minute_limit"),
    );
    expect(script).toContain(
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

  it("rejects invalid limits during construction", () => {
    const fake = redisDouble([]);

    expect(
      () =>
        new UpstashAnalysisQuota(fake.redis, {
          minuteLimit: 0,
          dayLimit: 20,
        }),
    ).toThrow("minuteLimit must be a positive integer");
    expect(
      () =>
        new UpstashAnalysisQuota(fake.redis, {
          minuteLimit: 3,
          dayLimit: 1.5,
        }),
    ).toThrow("dayLimit must be a positive integer");
  });
});
