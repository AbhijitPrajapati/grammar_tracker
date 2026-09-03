import type { CategoryFrequency, MistakeCategory } from "./analysis";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;

export interface DateRangeProperties {
  readonly start?: Date | null;
  readonly end?: Date | null;
}

export class DateRange {
  readonly start: Date | null;
  readonly end: Date | null;

  constructor(properties: DateRangeProperties = {}) {
    const start = properties.start ?? null;
    const end = properties.end ?? null;

    if (start !== null && Number.isNaN(start.getTime())) {
      throw new TypeError("Date range start must be a valid date");
    }
    if (end !== null && Number.isNaN(end.getTime())) {
      throw new TypeError("Date range end must be a valid date");
    }
    if (start !== null && end !== null && start > end) {
      throw new RangeError("Date range start must not be after its end");
    }

    this.start = start === null ? null : new Date(start);
    this.end = end === null ? null : new Date(end);
    Object.freeze(this);
  }

  get durationMilliseconds(): number | null {
    if (this.start === null || this.end === null) return null;
    return this.end.getTime() - this.start.getTime();
  }
}

export interface Distribution {
  readonly mistakeFrequencies: readonly CategoryFrequency[];
  readonly totalSpeeches: number;
}

export interface TimeSeriesPoint {
  readonly time: Date;
  readonly occurrences: number;
  readonly opportunities: number;
}

export interface TimeSeries {
  readonly points: readonly TimeSeriesPoint[];
}

export const TIME_BUCKETS = ["day", "week", "month", "year"] as const;
export type TimeBucket = (typeof TIME_BUCKETS)[number];

export function timeBucketFor(dateRange: DateRange): TimeBucket {
  const duration = dateRange.durationMilliseconds;
  if (duration === null) return "month";

  // Python timedelta.days floors positive partial days, which the previous
  // implementation's persisted analytics behavior used.
  const days = Math.floor(duration / MILLISECONDS_PER_DAY);
  if (days <= 14) return "day";
  if (days <= 90) return "week";
  if (days <= 730) return "month";
  return "year";
}

export interface AnalyticsDashboard {
  readonly distribution: Distribution;
  readonly timeSeries: TimeSeries;
  readonly mistakeCategory: MistakeCategory;
  readonly bucket: TimeBucket;
}
