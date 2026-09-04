import { AnalyticsFilters } from "@/src/presentation/components/analytics/AnalyticsFilters";
import { DistributionPanel } from "@/src/presentation/components/analytics/DistributionPanel";
import { TimeSeriesPanel } from "@/src/presentation/components/analytics/TimeSeriesPanel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/presentation/components/ui/card";
import {
  DATE_RANGE_OPTIONS,
  getCurrentUserAnalytics,
} from "@/src/interfaces/next/queries/analytics";
import {
  MISTAKE_CATEGORY_OPTIONS,
  mistakeCategoryLabel,
} from "@/src/presentation/mistake-categories";

interface AnalyticsSearchParams {
  readonly range?: string | string[];
  readonly category?: string | string[];
}

// Gets analytics selections from search parameters
export default async function AnalyticsPage({
  searchParams,
}: {
  readonly searchParams: Promise<AnalyticsSearchParams>;
}) {
  const selected = await searchParams;
  const analytics = await getCurrentUserAnalytics(
    firstValue(selected.range),
    firstValue(selected.category),
  );
  const selectedDateRangeLabel =
    DATE_RANGE_OPTIONS.find((option) => option.value === analytics.dateRange)
      ?.label ?? "All Time";

  return (
    <main className="px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div>
          <p className="text-sm font-medium text-primary">Analytics</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Track recurring mistakes over time
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Choose a date range and a mistake category to inspect analytics.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnalyticsFilters
              dateRange={analytics.dateRange}
              mistakeCategory={analytics.mistakeCategory}
              dateRanges={DATE_RANGE_OPTIONS}
              mistakeCategories={MISTAKE_CATEGORY_OPTIONS}
            />
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Distribution</CardTitle>
              <CardDescription>
                Error rate by category for {selectedDateRangeLabel}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DistributionPanel
                distribution={analytics.dashboard.distribution}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Time series</CardTitle>
              <CardDescription>
                Error-rate trend for{" "}
                {mistakeCategoryLabel(analytics.mistakeCategory)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TimeSeriesPanel timeSeries={analytics.dashboard.timeSeries} />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
