"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { MistakeCategory } from "@/src/core/domain/analysis";

type DateRangeSelection = "all_time" | "yearly" | "monthly" | "weekly";

interface AnalyticsFiltersProps {
  readonly dateRange: DateRangeSelection;
  readonly mistakeCategory: MistakeCategory;
  readonly dateRanges: readonly {
    readonly label: string;
    readonly value: DateRangeSelection;
  }[];
  readonly mistakeCategories: readonly {
    readonly id: MistakeCategory;
    readonly label: string;
  }[];
}

export function AnalyticsFilters({
  dateRange,
  mistakeCategory,
  dateRanges,
  mistakeCategories,
}: AnalyticsFiltersProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(
    nextDateRange: DateRangeSelection,
    nextCategory: MistakeCategory,
  ): void {
    const query = new URLSearchParams({
      range: nextDateRange,
      category: nextCategory,
    });
    startTransition(() => {
      router.replace(`/analytics?${query.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-2" aria-busy={isPending}>
        <div className="space-y-2">
          <Label htmlFor="date-range">Date range</Label>
          <Select
            id="date-range"
            value={dateRange}
            disabled={isPending}
            onChange={(event) =>
              navigate(
                event.target.value as DateRangeSelection,
                mistakeCategory,
              )
            }
          >
            {dateRanges.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mistake-category">Mistake category</Label>
          <Select
            id="mistake-category"
            value={mistakeCategory}
            disabled={isPending}
            onChange={(event) =>
              navigate(dateRange, event.target.value as MistakeCategory)
            }
          >
            {mistakeCategories.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <p
        className="min-h-5 text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {isPending ? "Updating analytics..." : null}
      </p>
    </div>
  );
}
