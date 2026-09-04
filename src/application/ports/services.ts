import type { AudioSample } from "../contracts/audio";
import type { StagedAudioReference } from "../contracts/staged-audio";
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
export interface SpeechAnalysisResult {
  readonly analysis: Analysis;
  readonly transcript: string;
}
export interface SpeechAnalyzer {
  analyze(audio: AudioSample): Promise<SpeechAnalysisResult>;
}

export interface AnalysisQuota {
  tryConsume(userId: UserId): Promise<boolean>;
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
  delete(userId: UserId, reference: StagedAudioReference): Promise<void>;
}
