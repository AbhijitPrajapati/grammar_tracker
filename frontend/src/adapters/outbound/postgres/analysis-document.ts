import { z } from "zod";

import {
  Analysis,
  MISTAKE_CATEGORIES,
} from "@/src/core/domain/analysis";

export const ANALYSIS_DOCUMENT_VERSION = 2 as const;

const analysisDocumentSchema = z.object({
  schema_version: z.literal(ANALYSIS_DOCUMENT_VERSION),
  mistakes: z.array(
    z.object({
      category: z.enum(MISTAKE_CATEGORIES),
      original_text: z.string(),
      correction: z.string(),
      explanation: z.string(),
    }),
  ),
  frequencies: z.array(
    z.object({
      category: z.enum(MISTAKE_CATEGORIES),
      occurrences: z.number().int().nonnegative(),
      opportunities: z.number().int().nonnegative(),
    }),
  ),
  feedback: z.string(),
});

export type AnalysisDocument = z.infer<typeof analysisDocumentSchema>;

export function analysisToDocument(analysis: Analysis): AnalysisDocument {
  return {
    schema_version: ANALYSIS_DOCUMENT_VERSION,
    mistakes: analysis.mistakes.map((mistake) => ({
      category: mistake.category,
      original_text: mistake.originalText,
      correction: mistake.correction,
      explanation: mistake.explanation,
    })),
    frequencies: analysis.frequencies.map((frequency) => ({
      category: frequency.category,
      occurrences: frequency.occurrences,
      opportunities: frequency.opportunities,
    })),
    feedback: analysis.feedback,
  };
}

export function analysisFromDocument(document: unknown): Analysis {
  const parsed = analysisDocumentSchema.parse(document);
  return new Analysis({
    mistakes: parsed.mistakes.map((mistake) => ({
      category: mistake.category,
      originalText: mistake.original_text,
      correction: mistake.correction,
      explanation: mistake.explanation,
    })),
    frequencies: parsed.frequencies,
    feedback: parsed.feedback,
  });
}
