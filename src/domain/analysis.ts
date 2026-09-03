export const MISTAKE_CATEGORIES = [
  "subject_verb_agreement",
  "verb_tense",
  "article_usage",
  "preposition_usage",
  "word_order",
  "plurality",
] as const;

export type MistakeCategory = (typeof MISTAKE_CATEGORIES)[number];

export interface MistakeProperties {
  readonly category: MistakeCategory;
  readonly originalText: string;
  readonly correction: string;
  readonly explanation: string;
}

// A single mistake
export class Mistake implements MistakeProperties {
  readonly category: MistakeCategory;
  readonly originalText: string;
  readonly correction: string;
  readonly explanation: string;

  constructor(properties: MistakeProperties) {
    this.category = properties.category;
    this.originalText = properties.originalText;
    this.correction = properties.correction;
    this.explanation = properties.explanation;
    Object.freeze(this);
  }
}

export interface CategoryFrequencyProperties {
  readonly category: MistakeCategory;
  readonly occurrences: number;
  readonly opportunities: number;
}

// Category frequencies tored in Postgres for easy analytics
export class CategoryFrequency implements CategoryFrequencyProperties {
  readonly category: MistakeCategory;
  readonly occurrences: number;
  readonly opportunities: number;

  constructor(properties: CategoryFrequencyProperties) {
    if (properties.occurrences < 0 || properties.opportunities < 0) {
      throw new RangeError("Frequency counts cannot be negative");
    }
    if (properties.occurrences > properties.opportunities) {
      throw new RangeError("Occurrences cannot exceed opportunities");
    }

    this.category = properties.category;
    this.occurrences = properties.occurrences;
    this.opportunities = properties.opportunities;
    Object.freeze(this);
  }
}

// Displayed to user as error rate
export function errorRate(frequency: {
  readonly occurrences: number;
  readonly opportunities: number;
}): number {
  return frequency.opportunities === 0
    ? 0
    : frequency.occurrences / frequency.opportunities;
}

export interface AnalysisProperties {
  readonly mistakes: readonly MistakeProperties[];
  readonly frequencies: readonly CategoryFrequencyProperties[];
  readonly feedback: string;
}

// Complete analysis structure
export class Analysis {
  readonly mistakes: readonly Mistake[];
  readonly frequencies: readonly CategoryFrequency[];
  readonly feedback: string;

  constructor(properties: AnalysisProperties) {
    const frequencies = properties.frequencies.map(
      (frequency) => new CategoryFrequency(frequency),
    );
    const frequencyCategories = frequencies.map(({ category }) => category);

    // Validation
    if (new Set(frequencyCategories).size !== frequencyCategories.length) {
      throw new Error("Analysis frequencies must be unique by category");
    }

    const coveredCategories = new Set(frequencyCategories);
    if (
      properties.mistakes.some(
        ({ category }) => !coveredCategories.has(category),
      )
    ) {
      throw new Error("Every detected mistake requires a category frequency");
    }

    this.mistakes = Object.freeze(
      properties.mistakes.map((mistake) => new Mistake(mistake)),
    );
    this.frequencies = Object.freeze(frequencies);
    this.feedback = properties.feedback;
    Object.freeze(this);
  }
}
