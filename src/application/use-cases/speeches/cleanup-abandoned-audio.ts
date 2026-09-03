import type {
  StagedAudioCleanupSummary,
  StagedAudioJanitor,
} from "../../ports/services";

const DEFAULT_MAXIMUM_STAGING_AGE_MS = 24 * 60 * 60 * 1_000;

export interface CleanupAbandonedAudioOptions {
  readonly maximumAgeMs?: number;
  readonly clock?: () => number;
}

export class CleanupAbandonedAudio {
  private readonly maximumAgeMs: number;
  private readonly clock: () => number;

  constructor(
    private readonly janitor: StagedAudioJanitor,
    options: CleanupAbandonedAudioOptions = {},
  ) {
    this.maximumAgeMs =
      options.maximumAgeMs ?? DEFAULT_MAXIMUM_STAGING_AGE_MS;
    this.clock = options.clock ?? Date.now;
    if (!Number.isSafeInteger(this.maximumAgeMs) || this.maximumAgeMs <= 0) {
      throw new TypeError("maximumAgeMs must be a positive integer");
    }
  }

  execute(): Promise<StagedAudioCleanupSummary> {
    return this.janitor.deleteUploadedBefore(
      new Date(this.clock() - this.maximumAgeMs),
    );
  }
}
