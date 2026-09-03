import type { AudioSample } from "../contracts/audio";
import type { Analysis } from "../../domain/analysis";
import type { UserId } from "../../domain/user";

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, passwordHash: string): Promise<boolean>;
}

export interface TokenService {
  issue(userId: UserId): Promise<string>;
  verify(token: string): Promise<UserId | null>;
}

export interface Transcriber {
  transcribe(audio: AudioSample): Promise<string>;
}

export interface GrammarAnalyzer {
  analyze(transcript: string): Promise<Analysis>;
}

export interface AnalysisQuota {
  /** Returns true only after atomically consuming one analysis attempt. */
  tryConsume(userId: UserId): Promise<boolean>;
}

export interface StagedAudioReference {
  readonly pathname: string;
  readonly etag: string;
}

/**
 * Resolves temporary audio without exposing a storage vendor or URL to the
 * application. Implementations must enforce that the reference belongs to the
 * authenticated user.
 */
export interface StagedAudioStore {
  resolve(
    userId: UserId,
    reference: StagedAudioReference,
  ): Promise<AudioSample>;
  delete(
    userId: UserId,
    reference: StagedAudioReference,
  ): Promise<void>;
}

export interface StagedAudioCleanupSummary {
  readonly inspected: number;
  readonly deleted: number;
}

export interface StagedAudioJanitor {
  deleteUploadedBefore(cutoff: Date): Promise<StagedAudioCleanupSummary>;
}
