import "server-only";

import { toStreamingFile } from "openai";

import type { AudioSample } from "@/src/core/application/contracts/audio";
import type { Transcriber } from "@/src/core/application/ports/services";
import { OpenAiClient } from "./client";

export class OpenAiTranscriber implements Transcriber {
  constructor(
    private readonly client: OpenAiClient,
    private readonly model: string,
  ) {}

  async transcribe(audio: AudioSample): Promise<string> {
    return this.client.execute("transcription", async () => {
      const stream = await audio.openStream();
      const file = toStreamingFile(stream, audio.filename, {
        type: audio.mediaType,
      });
      const { data, request_id: requestId } = await this.client.sdk.audio.transcriptions
        .create({ model: this.model, file })
        .withResponse();
      return { data: data.text, requestId };
    });
  }
}
