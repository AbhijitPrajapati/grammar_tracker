import {
  type AnalyticsDashboard,
  type AnalyticsReader,
  type DateRange,
  timeBucketFor,
} from "../../../domain/analytics";
import type { MistakeCategory } from "../../../domain/analysis";
import type { UserId } from "../../../domain/user";

export class RetrieveAnalyticsDashboard {
  constructor(private readonly analytics: AnalyticsReader) {}

  async execute(
    userId: UserId,
    dateRange: DateRange,
    mistakeCategory: MistakeCategory,
  ): Promise<AnalyticsDashboard> {
    const bucket = timeBucketFor(dateRange);
    const [distribution, timeSeries] = await Promise.all([
      this.analytics.distribution(userId, dateRange),
      this.analytics.timeSeries(userId, dateRange, mistakeCategory, bucket),
    ]);

    return { distribution, timeSeries, mistakeCategory, bucket };
  }
}
