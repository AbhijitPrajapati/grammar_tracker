import { describe, expect, it, vi } from "vitest";

import { AudioSample } from "@/src/application/contracts/audio";
import { Analysis } from "@/src/domain/analysis";
import type { OpenAiClient } from "@/src/infrastructure/openai/client";
import {
  DETERMINISTIC_TRANSCRIPT,
  DeterministicGrammarAnalyzer,
  DeterministicTranscriber,
} from "@/src/infrastructure/openai/deterministic";
import { OpenAiGrammarAnalyzer } from "@/src/infrastructure/openai/grammar-analyzer";
import { OpenAiTranscriber } from "@/src/infrastructure/openai/transcriber";

function stream(byte: number): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(Uint8Array.of(byte));
      controller.close();
    },
  });
}

describe("OpenAI adapters", () => {
  it("reopens audio when the client retries the transcription operation", async () => {
    const openStream = vi
      .fn<() => Promise<ReadableStream<Uint8Array>>>()
      .mockResolvedValueOnce(stream(1))
      .mockResolvedValueOnce(stream(2));
    const audio = new AudioSample({
      sizeBytes: 1,
      filename: "practice.webm",
      mediaType: "audio/webm",
      openStream,
    });
    const withResponse = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error("retry me"))
      .mockResolvedValueOnce({
        data: { text: "I spoke clearly." },
        request_id: "req_transcription",
      });
    const create = vi.fn(
      (requestInput: {
        model: string;
        file: { readonly name?: string; readonly type?: string };
      }) => {
        void requestInput;
        return { withResponse };
      },
    );
    const execute = vi.fn(
      async (
        _operation: string,
        request: () => Promise<{ data: string; requestId: string | null }>,
      ) => {
        await request().catch(() => undefined);
        return (await request()).data;
      },
    );
    const client = {
      sdk: { audio: { transcriptions: { create } } },
      execute,
    } as unknown as OpenAiClient;

    await expect(
      new OpenAiTranscriber(client, "gpt-4o-mini-transcribe").transcribe(audio),
    ).resolves.toBe("I spoke clearly.");

    expect(openStream).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      model: "gpt-4o-mini-transcribe",
      file: expect.objectContaining({
        name: "practice.webm",
        type: "audio/webm",
      }),
    });
    expect(execute).toHaveBeenCalledWith("transcription", expect.any(Function));
  });

  it("requests strict structured output and maps snake-case provider fields", async () => {
    const output = {
      mistakes: [
        {
          category: "verb_tense" as const,
          original_text: "I go yesterday",
          correction: "I went yesterday",
          explanation: "Use past tense.",
        },
      ],
      frequencies: [
        { category: "verb_tense" as const, occurrences: 1, opportunities: 1 },
      ],
      feedback: "Review past tense.",
    };
    const parse = vi.fn(
      (requestInput: {
        model: string;
        store: boolean;
        input: readonly unknown[];
        text?: { format?: unknown };
      }) => {
        void requestInput;
        return {
          withResponse: async () => ({
            data: { output_parsed: output },
            request_id: "req_analysis",
          }),
        };
      },
    );
    const execute = vi.fn(
      async (
        _operation: string,
        request: () => Promise<{
          data: { output_parsed: typeof output };
          requestId: string | null;
        }>,
      ) => (await request()).data,
    );
    const client = {
      sdk: { responses: { parse } },
      execute,
    } as unknown as OpenAiClient;

    const result = await new OpenAiGrammarAnalyzer(client, "o4-mini").analyze(
      "I go yesterday",
    );

    expect(result).toBeInstanceOf(Analysis);
    expect(result.mistakes[0]).toMatchObject({
      originalText: "I go yesterday",
      correction: "I went yesterday",
    });
    expect(result.frequencies[0]).toMatchObject({
      category: "verb_tense",
      occurrences: 1,
      opportunities: 1,
    });
    expect(parse).toHaveBeenCalledOnce();
    const request = parse.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      model: "o4-mini",
      store: false,
      input: [
        {
          role: "system",
          content:
            "Analyze the learner's English grammar. Use only the categories in the supplied JSON schema. Count an opportunity whenever the category could be evaluated; occurrences must not exceed opportunities. Return JSON only.",
        },
        { role: "user", content: "I go yesterday" },
      ],
      text: {
        format: expect.objectContaining({
          type: "json_schema",
          name: "grammar_analysis",
          strict: true,
        }),
      },
    });
    const serializedSchema = JSON.stringify(request?.text?.format);
    for (const category of [
      "subject_verb_agreement",
      "verb_tense",
      "article_usage",
      "preposition_usage",
      "word_order",
      "plurality",
    ]) {
      expect(serializedSchema).toContain(category);
    }
  });

  it("rejects a parsed response with no structured payload", async () => {
    const client = {
      sdk: {
        responses: {
          parse: () => ({
            withResponse: async () => ({
              data: { output_parsed: null },
              request_id: "req_empty",
            }),
          }),
        },
      },
      execute: async (
        _operation: string,
        request: () => Promise<{ data: { output_parsed: null } }>,
      ) => (await request()).data,
    } as unknown as OpenAiClient;

    await expect(
      new OpenAiGrammarAnalyzer(client, "o4-mini").analyze("Transcript"),
    ).rejects.toThrow("did not satisfy the analysis schema");
  });

  it("preserves the deterministic E2E fixture exactly", async () => {
    const transcript = await new DeterministicTranscriber().transcribe();
    const analysis = await new DeterministicGrammarAnalyzer().analyze();

    expect(transcript).toBe(DETERMINISTIC_TRANSCRIPT);
    expect(transcript).toBe("She go to the store yesterday and buy two apple.");
    expect(analysis.mistakes.map(({ category }) => category)).toEqual([
      "subject_verb_agreement",
      "verb_tense",
      "plurality",
    ]);
    expect(analysis.frequencies).toHaveLength(6);
    expect(analysis.feedback).toBe(
      "Good effort. Focus on agreement, tense, and plural nouns.",
    );
  });
});
