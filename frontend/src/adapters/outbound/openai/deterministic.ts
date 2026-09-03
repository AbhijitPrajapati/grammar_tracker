import "server-only";

import type {
  GrammarAnalyzer,
  Transcriber,
} from "@/src/core/application/ports/services";
import { Analysis } from "@/src/core/domain/analysis";

export const DETERMINISTIC_TRANSCRIPT =
  "She go to the store yesterday and buy two apple.";

export class DeterministicTranscriber implements Transcriber {
  async transcribe(): Promise<string> {
    return DETERMINISTIC_TRANSCRIPT;
  }
}

export class DeterministicGrammarAnalyzer implements GrammarAnalyzer {
  async analyze(): Promise<Analysis> {
    return new Analysis({
      mistakes: [
        {
          category: "subject_verb_agreement",
          originalText: "She go",
          correction: "She goes",
          explanation: "A third-person singular subject needs 'goes'.",
        },
        {
          category: "verb_tense",
          originalText: "buy",
          correction: "bought",
          explanation: "The completed action requires past tense.",
        },
        {
          category: "plurality",
          originalText: "two apple",
          correction: "two apples",
          explanation: "A quantity greater than one needs a plural noun.",
        },
      ],
      frequencies: [
        {
          category: "subject_verb_agreement",
          occurrences: 1,
          opportunities: 1,
        },
        { category: "verb_tense", occurrences: 1, opportunities: 2 },
        { category: "article_usage", occurrences: 0, opportunities: 2 },
        {
          category: "preposition_usage",
          occurrences: 0,
          opportunities: 1,
        },
        { category: "word_order", occurrences: 0, opportunities: 1 },
        { category: "plurality", occurrences: 1, opportunities: 1 },
      ],
      feedback: "Good effort. Focus on agreement, tense, and plural nouns.",
    });
  }
}
