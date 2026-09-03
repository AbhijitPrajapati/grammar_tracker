import { describe, expect, it } from "vitest";

import { Analysis } from "@/src/core/domain/analysis";
import {
  analysisFromDocument,
  analysisToDocument,
} from "@/src/adapters/outbound/postgres/analysis-document";

describe("analysis document v2", () => {
  it("round-trips the fixed snake-case JSONB representation", () => {
    const analysis = new Analysis({
      mistakes: [
        {
          category: "verb_tense",
          originalText: "I go yesterday",
          correction: "I went yesterday",
          explanation: "Use past tense for a completed action.",
        },
      ],
      frequencies: [
        { category: "verb_tense", occurrences: 1, opportunities: 1 },
      ],
      feedback: "Keep practicing past-tense forms.",
    });

    const document = analysisToDocument(analysis);

    expect(document).toEqual({
      schema_version: 2,
      mistakes: [
        {
          category: "verb_tense",
          original_text: "I go yesterday",
          correction: "I went yesterday",
          explanation: "Use past tense for a completed action.",
        },
      ],
      frequencies: [
        { category: "verb_tense", occurrences: 1, opportunities: 1 },
      ],
      feedback: "Keep practicing past-tense forms.",
    });
    expect(analysisFromDocument(document)).toEqual(analysis);
  });

  it("rejects any document version other than the sole live version", () => {
    expect(() =>
      analysisFromDocument({
        schema_version: 1,
        mistakes: [],
        frequencies: [],
        feedback: "",
      }),
    ).toThrow();
  });
});
