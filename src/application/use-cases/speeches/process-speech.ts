import { InferenceQuotaReached, AnalysisQuotaReached } from "../../errors";
import type {
  AnalysisQuota,
  SpeechAnalyzer,
  StagedAudioStore,
} from "../../ports/services";
import type { StagedAudioReference } from "../../contracts/staged-audio";
import type { SpeechRepository } from "../../ports/repositories";
import type { Speech } from "../../../domain/speech";
import type { UserId } from "../../../domain/user";

export class ProcessSpeech {
  constructor(
    private readonly stagedAudio: StagedAudioStore,
    private readonly speeches: SpeechRepository,
    private readonly speechAnalyzer: SpeechAnalyzer,
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

      const result = await this.speechAnalyzer.analyze(audio);
      return await this.speeches.create(
        userId,
        result.transcript,
        result.analysis,
      );
    } catch (error) {
      if (error instanceof InferenceQuotaReached) {
        throw new AnalysisQuotaReached({ cause: error });
      }
      throw error;
    } finally {
      // Report errors cleaning up staged audio
      await this.stagedAudio.delete(userId, reference).catch((error) => {
        this.reportCleanupFailure(error);
      });
    }
  }
}
