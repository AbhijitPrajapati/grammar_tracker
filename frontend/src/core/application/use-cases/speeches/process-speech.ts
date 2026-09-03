import type { AudioSample } from "../../contracts/audio";
import {
  AnalysisQuotaExhausted,
  AnalysisQuotaReached,
} from "../../errors";
import type {
  AnalysisQuota,
  GrammarAnalyzer,
  Transcriber,
} from "../../ports/services";
import type { Speech, SpeechRepository } from "../../../domain/speech";
import type { UserId } from "../../../domain/user";

export class ProcessSpeech {
  constructor(
    private readonly speeches: SpeechRepository,
    private readonly transcriber: Transcriber,
    private readonly grammarAnalyzer: GrammarAnalyzer,
    private readonly quota: AnalysisQuota,
  ) {}

  async execute(userId: UserId, audio: AudioSample): Promise<Speech> {
    if (!(await this.quota.tryConsume(userId))) {
      throw new AnalysisQuotaReached();
    }

    try {
      const transcript = await this.transcriber.transcribe(audio);
      const analysis = await this.grammarAnalyzer.analyze(transcript);
      return await this.speeches.create(userId, transcript, analysis);
    } catch (error) {
      if (error instanceof AnalysisQuotaExhausted) {
        throw new AnalysisQuotaReached({ cause: error });
      }
      throw error;
    }
  }
}
