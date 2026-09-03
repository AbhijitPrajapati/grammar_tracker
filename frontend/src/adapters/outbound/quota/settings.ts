export const MINUTE_WINDOW_MS = 60_000;
export const DAY_WINDOW_MS = 86_400_000;

/**
 * The additional millisecond is required because an attempt exactly one day old
 * is still inside the rolling window.
 */
export const QUOTA_KEY_TTL_MS = DAY_WINDOW_MS + 1;

export interface AnalysisQuotaOptions {
  readonly minuteLimit: number;
  readonly dayLimit: number;
  readonly clock?: () => number;
}

export function validateQuotaOptions(options: AnalysisQuotaOptions): void {
  assertPositiveInteger("minuteLimit", options.minuteLimit);
  assertPositiveInteger("dayLimit", options.dayLimit);
}

export function readTimestamp(clock: () => number): number {
  const timestamp = clock();
  if (!Number.isSafeInteger(timestamp)) {
    throw new TypeError(
      "The analysis quota clock must return an integer timestamp",
    );
  }
  return timestamp;
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}
