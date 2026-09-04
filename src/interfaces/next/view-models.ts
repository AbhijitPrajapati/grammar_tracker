import type {
  AnalyticsDashboard,
  Distribution,
  TimeSeries,
} from "@/src/domain/analytics";
import type { Speech } from "@/src/domain/speech";

// Client-side representations for speeeches and analytics
export interface SpeechView {
  readonly id: string;
  readonly createdAt: string;
  readonly transcript: string;
  readonly analysis: {
    readonly feedback: string;
    readonly frequencies: readonly {
      readonly category:
        | "subject_verb_agreement"
        | "verb_tense"
        | "article_usage"
        | "preposition_usage"
        | "word_order"
        | "plurality";
      readonly occurrences: number;
      readonly opportunities: number;
    }[];
    readonly mistakes: readonly {
      readonly category:
        | "subject_verb_agreement"
        | "verb_tense"
        | "article_usage"
        | "preposition_usage"
        | "word_order"
        | "plurality";
      readonly originalText: string;
      readonly correction: string;
      readonly explanation: string;
    }[];
  };
}

export function toSpeechView(speech: Speech): SpeechView {
  return {
    id: speech.id,
    createdAt: speech.createdAt.toISOString(),
    transcript: speech.transcript,
    analysis: {
      feedback: speech.analysis.feedback,
      frequencies: speech.analysis.frequencies.map((frequency) => ({
        category: frequency.category,
        occurrences: frequency.occurrences,
        opportunities: frequency.opportunities,
      })),
      mistakes: speech.analysis.mistakes.map((mistake) => ({
        category: mistake.category,
        originalText: mistake.originalText,
        correction: mistake.correction,
        explanation: mistake.explanation,
      })),
    },
  };
}

export interface DistributionView {
  readonly totalSpeeches: number;
  readonly mistakeFrequencies: readonly {
    readonly category: SpeechView["analysis"]["frequencies"][number]["category"];
    readonly occurrences: number;
    readonly opportunities: number;
  }[];
}

export interface TimeSeriesView {
  readonly points: readonly {
    readonly time: string;
    readonly occurrences: number;
    readonly opportunities: number;
  }[];
}

export interface AnalyticsDashboardView {
  readonly distribution: DistributionView;
  readonly timeSeries: TimeSeriesView;
}

function toDistributionView(distribution: Distribution): DistributionView {
  return {
    totalSpeeches: distribution.totalSpeeches,
    mistakeFrequencies: distribution.mistakeFrequencies.map((frequency) => ({
      category: frequency.category,
      occurrences: frequency.occurrences,
      opportunities: frequency.opportunities,
    })),
  };
}

function toTimeSeriesView(timeSeries: TimeSeries): TimeSeriesView {
  return {
    points: timeSeries.points.map((point) => ({
      time: point.time.toISOString(),
      occurrences: point.occurrences,
      opportunities: point.opportunities,
    })),
  };
}

export function toAnalyticsDashboardView(
  dashboard: AnalyticsDashboard,
): AnalyticsDashboardView {
  return {
    distribution: toDistributionView(dashboard.distribution),
    timeSeries: toTimeSeriesView(dashboard.timeSeries),
  };
}
