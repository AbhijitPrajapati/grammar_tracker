import { describe, expect, it, vi } from "vitest";

import { AudioSample } from "@/src/application/contracts/audio";
import type { OpenAiClient } from "@/src/infrastructure/openai/client";
import {
  DETERMINISTIC_TRANSCRIPT,
  DeterministicSpeechAnalyzer,
} from "@/src/infrastructure/openai/deterministic";
import { OpenAiSpeechAnalyzer } from "@/src/infrastructure/openai/speech-analyzer";

function stream(byte: number): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(Uint8Array.of(byte));
      controller.close();
    },
  });
}

function audioSample(
  openStream: () => Promise<ReadableStream<Uint8Array>> = async () => stream(1),
): AudioSample {
  return new AudioSample({
    sizeBytes: 1,
    filename: "practice.webm",
    mediaType: "audio/webm",
    openStream,
  });
}

describe("OpenAI speech analyzer", () => {
  it("reopens audio when the client retries transcription", async () => {
    const openStream = vi
      .fn<() => Promise<ReadableStream<Uint8Array>>>()
      .mockResolvedValueOnce(stream(1))
      .mockResolvedValueOnce(stream(2));
    const transcriptionWithResponse = vi
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
        return { withResponse: transcriptionWithResponse };
      },
    );
    const parse = vi.fn(() => ({
      withResponse: async () => ({
        data: {
          output_parsed: {
            mistakes: [],
            frequencies: [],
            feedback: "Well done.",
          },
        },
        request_id: "req_analysis",
      }),
    }));
    const execute = vi.fn(
      async (operation: string, request: () => Promise<{ data: unknown }>) => {
        if (operation === "transcription") {
          await request().catch(() => undefined);
        }
        return (await request()).data;
      },
    );
    const client = {
      sdk: {
        audio: { transcriptions: { create } },
        responses: { parse },
      },
      execute,
    } as unknown as OpenAiClient;

    const result = await new OpenAiSpeechAnalyzer(
      client,
      "gpt-4o-mini-transcribe",
      "o4-mini",
    ).analyze(audioSample(openStream));

    expect(result.transcript).toBe("I spoke clearly.");
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

  it("requests structured analysis and maps provider fields", async () => {
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
    const create = vi.fn(() => ({
      withResponse: async () => ({
        data: { text: "I go yesterday" },
        request_id: "req_transcription",
      }),
    }));
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
      async (_operation: string, request: () => Promise<{ data: unknown }>) =>
        (await request()).data,
    );
    const client = {
      sdk: {
        audio: { transcriptions: { create } },
        responses: { parse },
      },
      execute,
    } as unknown as OpenAiClient;

    const result = await new OpenAiSpeechAnalyzer(
      client,
      "gpt-4o-mini-transcribe",
      "o4-mini",
    ).analyze(audioSample());

    expect(result.transcript).toBe("I go yesterday");
    expect(result.analysis.mistakes[0]).toMatchObject({
      originalText: "I go yesterday",
      correction: "I went yesterday",
    });
    expect(result.analysis.frequencies[0]).toMatchObject({
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
        audio: {
          transcriptions: {
            create: () => ({
              withResponse: async () => ({
                data: { text: "Transcript" },
                request_id: "req_transcription",
              }),
            }),
          },
        },
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
        request: () => Promise<{ data: unknown }>,
      ) => (await request()).data,
    } as unknown as OpenAiClient;

    await expect(
      new OpenAiSpeechAnalyzer(
        client,
        "gpt-4o-mini-transcribe",
        "o4-mini",
      ).analyze(audioSample()),
    ).rejects.toThrow("did not satisfy the analysis schema");
  });

  it("preserves the deterministic E2E fixture exactly", async () => {
    const result = await new DeterministicSpeechAnalyzer().analyze(
      audioSample(),
    );

    expect(result.transcript).toBe(DETERMINISTIC_TRANSCRIPT);
    expect(result.transcript).toBe(
      "She go to the store yesterday and buy two apple.",
    );
    expect(result.analysis.mistakes.map(({ category }) => category)).toEqual([
      "subject_verb_agreement",
      "verb_tense",
      "plurality",
    ]);
    expect(result.analysis.frequencies).toHaveLength(6);
    expect(result.analysis.feedback).toBe(
      "Good effort. Focus on agreement, tense, and plural nouns.",
    );
  });
});
