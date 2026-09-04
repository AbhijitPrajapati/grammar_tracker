import { mistakeCategoryLabel } from "@/src/presentation/mistake-categories";
import type { DistributionView } from "@/src/interfaces/next/view-models";
import { errorRate, MISTAKE_CATEGORIES } from "@/src/domain/analysis";

interface DistributionPanelProps {
  readonly distribution: DistributionView;
}

export function DistributionPanel({ distribution }: DistributionPanelProps) {
  const frequenciesByCategory = new Map(
    distribution.mistakeFrequencies.map((frequency) => [
      frequency.category,
      frequency,
    ]),
  );
  const frequencies = MISTAKE_CATEGORIES.map(
    (category) =>
      frequenciesByCategory.get(category) ?? {
        category,
        occurrences: 0,
        opportunities: 0,
      },
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>Total speeches: {distribution.totalSpeeches}</span>
        <span>Occurrences ÷ opportunities</span>
      </div>

      <div className="space-y-4" aria-label="Error rate by mistake category">
        {frequencies.map((frequency) => (
          <DistributionBar key={frequency.category} frequency={frequency} />
        ))}
      </div>

      <div
        className="grid grid-cols-5 text-xs text-muted-foreground"
        aria-hidden
      >
        <span>0%</span>
        <span className="text-center">25%</span>
        <span className="text-center">50%</span>
        <span className="text-center">75%</span>
        <span className="text-right">100%</span>
      </div>
    </div>
  );
}

interface DistributionBarProps {
  readonly frequency: DistributionView["mistakeFrequencies"][number];
}

function DistributionBar({ frequency }: DistributionBarProps) {
  const percentage = Math.round(errorRate(frequency) * 1_000) / 10;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">
          {mistakeCategoryLabel(frequency.category)}
        </span>
        <span className="whitespace-nowrap text-muted-foreground tabular-nums">
          {percentage}% · {frequency.occurrences}/{frequency.opportunities}
        </span>
      </div>
      <div
        className="h-3 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={`${mistakeCategoryLabel(frequency.category)} error rate`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        aria-valuetext={`${percentage}%`}
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{
            width: `${Math.min(percentage, 100)}%`,
            minWidth: percentage > 0 ? "2px" : undefined,
          }}
        />
      </div>
    </div>
  );
}
