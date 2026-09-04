import "server-only";

import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import type {
  SpeechAnalysisResult,
  SpeechAnalyzer,
} from "@/src/application/ports/services";
import { Analysis, MISTAKE_CATEGORIES } from "@/src/domain/analysis";
import { OpenAiClient } from "./client";
import { AudioSample } from "@/src/application/contracts/audio";
import { toStreamingFile } from "openai";

const analysisPayloadSchema = z.object({
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

const SYSTEM_PROMPT =
  "Analyze the learner's English grammar. Use only the categories in the supplied JSON schema. Count an opportunity whenever the category could be evaluated; occurrences must not exceed opportunities. Return JSON only.";

export class OpenAiSpeechAnalyzer implements SpeechAnalyzer {
  constructor(
    private readonly client: OpenAiClient,
    private readonly transcriptionModel: string,
    private readonly analysisModel: string,
  ) {}

  async analyze(audio: AudioSample): Promise<SpeechAnalysisResult> {
    const transcript = await this.client.execute("transcription", async () => {
      const stream = await audio.openStream();
      const file = toStreamingFile(stream, audio.filename, {
        type: audio.mediaType,
      });
      const { data, request_id: requestId } =
        await this.client.sdk.audio.transcriptions
          .create({ model: this.transcriptionModel, file })
          .withResponse();
      return { data: data.text, requestId };
    });

    const response = await this.client.execute("grammar_analysis", async () => {
      const { data, request_id: requestId } = await this.client.sdk.responses
        .parse({
          model: this.analysisModel,
          store: false,
          input: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: transcript },
          ],
          text: {
            format: zodTextFormat(analysisPayloadSchema, "grammar_analysis"),
          },
        })
        .withResponse();
      return { data, requestId };
    });

    if (response.output_parsed === null) {
      throw new Error("OpenAI output did not satisfy the analysis schema");
    }

    const analysis = new Analysis({
      mistakes: response.output_parsed.mistakes.map((mistake) => ({
        category: mistake.category,
        originalText: mistake.original_text,
        correction: mistake.correction,
        explanation: mistake.explanation,
      })),
      frequencies: response.output_parsed.frequencies,
      feedback: response.output_parsed.feedback,
    });
    return { analysis, transcript };
  }
}
