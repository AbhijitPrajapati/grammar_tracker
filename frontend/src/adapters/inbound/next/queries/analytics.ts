import "server-only";

import { DateRange } from "@/src/core/domain/analytics";
import type { MistakeCategory } from "@/src/core/domain/analysis";
import { getApplicationContainer } from "@/src/bootstrap/container";
import { requireCurrentUser } from "../session";
import {
  dateRangeSelectionSchema,
  mistakeCategorySchema,
} from "../validation";
import {
  toAnalyticsDashboardView,
  type AnalyticsDashboardView,
} from "../view-models";

export const DATE_RANGE_OPTIONS = [
  { value: "all_time", label: "All Time" },
  { value: "yearly", label: "Yearly" },
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
] as const;

export type DateRangeSelection =
  (typeof DATE_RANGE_OPTIONS)[number]["value"];

export interface AnalyticsSelection {
  readonly dateRange: DateRangeSelection;
  readonly mistakeCategory: MistakeCategory;
}

export interface AnalyticsQueryResult extends AnalyticsSelection {
  readonly dashboard: AnalyticsDashboardView;
}

export async function getCurrentUserAnalytics(
  rangeInput: string | string[] | undefined,
  categoryInput: string | string[] | undefined,
): Promise<AnalyticsQueryResult> {
  const dateRange = dateRangeSelectionSchema.parse(firstValue(rangeInput));
  const categoryResult = mistakeCategorySchema.safeParse(
    firstValue(categoryInput),
  );
  const mistakeCategory = categoryResult.success
    ? categoryResult.data
    : "subject_verb_agreement";
  const user = await requireCurrentUser();
  const dashboard = await getApplicationContainer().retrieveAnalyticsDashboard.execute(
    user.id,
    dateRangeFor(dateRange, new Date()),
    mistakeCategory,
  );

  return {
    dateRange,
    mistakeCategory,
    dashboard: toAnalyticsDashboardView(dashboard),
  };
}

export function dateRangeFor(
  selection: DateRangeSelection,
  now: Date,
): DateRange {
  if (selection === "all_time") return new DateRange();
  const days = selection === "weekly" ? 7 : selection === "monthly" ? 30 : 365;
  return new DateRange({
    start: new Date(now.getTime() - days * 24 * 60 * 60 * 1_000),
    end: now,
  });
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
