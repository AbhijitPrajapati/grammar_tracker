export { AudioSample } from "./contracts/audio-sample";
export type { AuthSession } from "./contracts/auth";
export type { StagedAudioReference } from "./contracts/staged-audio";
export {
  AnalysisQuotaReached,
  ApplicationError,
  EmailAlreadyRegistered,
  InferenceQuotaReached,
  InvalidAudio,
  InvalidCredentials,
  InvalidCurrentPassword,
  InvalidToken,
  SpeechNotFound,
} from "./errors";
export {
  EmailConflictError,
  type AnalyticsReader,
  type SpeechRepository,
  type StoredUser,
  type UserRepository,
} from "./ports/repositories";
export type {
  AnalysisQuota,
  PasswordHasher,
  SpeechAnalyzer,
  SpeechAnalysisResult,
  StagedAudioStore,
  TokenService,
} from "./ports/services";
export { ChangePassword } from "./use-cases/account/change-password";
export { DeleteUser } from "./use-cases/account/delete-user";
export { RetrieveAnalyticsDashboard } from "./use-cases/analytics/retrieve-analytics-dashboard";
export { Login } from "./use-cases/auth/login";
export { RegisterAndStartSession } from "./use-cases/auth/register-and-start-session";
export { ResolveSession } from "./use-cases/auth/resolve-session";
export { DeleteSpeech } from "./use-cases/speeches/delete-speech";
export { ListSpeeches } from "./use-cases/speeches/list-speeches";
export { ProcessSpeech } from "./use-cases/speeches/process-speech";
