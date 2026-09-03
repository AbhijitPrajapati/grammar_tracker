"use client";

import type { TimeSeriesView } from "@/src/interfaces/next/view-models";
import { errorRate } from "@/src/domain/analysis";

interface TimeSeriesPanelProps {
  readonly timeSeries: TimeSeriesView;
}

const WIDTH = 640;
const HEIGHT = 320;
const MARGIN = { top: 12, right: 18, bottom: 50, left: 48 } as const;
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;
const Y_TICKS = [0, 0.25, 0.5, 0.75, 1] as const;

export function TimeSeriesPanel({ timeSeries }: TimeSeriesPanelProps) {
  if (timeSeries.points.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No time series data available.
      </p>
    );
  }

  const points = timeSeries.points
    .map((point) => ({ ...point, timestamp: new Date(point.time).getTime() }))
    .sort((left, right) => left.timestamp - right.timestamp);
  const startTime = points[0].timestamp;
  const endTime = points.at(-1)!.timestamp;
  const plottedPoints = points.map((point) => ({
    ...point,
    rate: errorRate(point),
  }));

  const x = (time: number) =>
    startTime === endTime
      ? MARGIN.left + PLOT_WIDTH / 2
      : MARGIN.left + ((time - startTime) / (endTime - startTime)) * PLOT_WIDTH;
  const y = (rate: number) => MARGIN.top + (1 - rate) * PLOT_HEIGHT;
  const linePath = plottedPoints
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${x(point.timestamp)} ${y(point.rate)}`,
    )
    .join(" ");
  const xTicks = timeTicks(startTime, endTime, points.length);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>Error rate</span>
        <span>Occurrences ÷ opportunities</span>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full min-w-120"
          role="img"
          aria-label="Error rate over time"
        >
          {Y_TICKS.map((tick) => {
            const tickY = y(tick);
            return (
              <g key={tick}>
                <line
                  x1={MARGIN.left}
                  y1={tickY}
                  x2={MARGIN.left + PLOT_WIDTH}
                  y2={tickY}
                  stroke="var(--border)"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={MARGIN.left - 9}
                  y={tickY + 4}
                  textAnchor="end"
                  fill="var(--muted-foreground)"
                  fontSize="11"
                >
                  {Math.round(tick * 100)}%
                </text>
              </g>
            );
          })}

          {xTicks.map((tick) => {
            const tickX = x(tick);
            return (
              <g key={tick}>
                <line
                  x1={tickX}
                  y1={MARGIN.top + PLOT_HEIGHT}
                  x2={tickX}
                  y2={MARGIN.top + PLOT_HEIGHT + 5}
                  stroke="var(--muted-foreground)"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={tickX}
                  y={MARGIN.top + PLOT_HEIGHT + 22}
                  textAnchor="middle"
                  fill="var(--muted-foreground)"
                  fontSize="11"
                >
                  {formatDate(tick, endTime - startTime)}
                </text>
              </g>
            );
          })}

          <path
            d={linePath}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {plottedPoints.map((point) => (
            <circle
              key={point.time}
              cx={x(point.timestamp)}
              cy={y(point.rate)}
              r="4"
              fill="var(--background)"
              stroke="var(--primary)"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            >
              <title>
                {`${formatDate(point.timestamp, endTime - startTime)}: ${formatRate(point.rate)} (${point.occurrences}/${point.opportunities})`}
              </title>
            </circle>
          ))}

          <text
            x={MARGIN.left + PLOT_WIDTH / 2}
            y={HEIGHT - 4}
            textAnchor="middle"
            fill="var(--muted-foreground)"
            fontSize="11"
          >
            Time
          </text>
        </svg>
      </div>
    </div>
  );
}

function timeTicks(start: number, end: number, pointCount: number): number[] {
  if (start === end) return [start];
  const tickCount = Math.min(pointCount, 5);
  return Array.from(
    { length: tickCount },
    (_, index) => start + ((end - start) * index) / (tickCount - 1),
  );
}

function formatDate(time: number, duration: number): string {
  const options: Intl.DateTimeFormatOptions =
    duration > 365 * 24 * 60 * 60 * 1_000
      ? { month: "short", year: "2-digit" }
      : { month: "short", day: "numeric" };
  return new Intl.DateTimeFormat("en-US", options).format(new Date(time));
}

function formatRate(rate: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(rate);
}
