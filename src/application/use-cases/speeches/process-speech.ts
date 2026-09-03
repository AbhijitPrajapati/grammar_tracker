import {
  AnalysisQuotaExhausted,
  AnalysisQuotaReached,
} from "../../errors";
import type {
  AnalysisQuota,
  GrammarAnalyzer,
  StagedAudioReference,
  StagedAudioStore,
  Transcriber,
} from "../../ports/services";
import type { SpeechRepository } from "../../ports/repositories";
import type { Speech } from "../../../domain/speech";
import type { UserId } from "../../../domain/user";

export class ProcessSpeech {
  constructor(
    private readonly stagedAudio: StagedAudioStore,
    private readonly speeches: SpeechRepository,
    private readonly transcriber: Transcriber,
    private readonly grammarAnalyzer: GrammarAnalyzer,
    private readonly quota: AnalysisQuota,
    private readonly reportCleanupFailure: (error: unknown) => void = () =>
      undefined,
  ) {}

  async execute(
    userId: UserId,
    reference: StagedAudioReference,
  ): Promise<Speech> {
    try {
      const audio = await this.stagedAudio.resolve(userId, reference);
      if (!(await this.quota.tryConsume(userId))) {
        throw new AnalysisQuotaReached();
      }

      const transcript = await this.transcriber.transcribe(audio);
      const analysis = await this.grammarAnalyzer.analyze(transcript);
      return await this.speeches.create(userId, transcript, analysis);
    } catch (error) {
      if (error instanceof AnalysisQuotaExhausted) {
        throw new AnalysisQuotaReached({ cause: error });
      }
      throw error;
    } finally {
      // Cleanup is best effort because the daily orphan sweep is the durable
      // fallback. It must not hide a completed analysis or processing error.
      await this.stagedAudio.delete(userId, reference).catch((error) => {
        this.reportCleanupFailure(error);
      });
    }
  }
}
