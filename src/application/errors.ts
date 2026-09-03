export type ApplicationErrorCode =
  | "email_already_registered"
  | "invalid_audio"
  | "invalid_credentials"
  | "invalid_current_password"
  | "invalid_token"
  | "analysis_quota_reached"
  | "speech_not_found";

export class ApplicationError extends Error {
  constructor(
    readonly code: ApplicationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class EmailAlreadyRegistered extends ApplicationError {
  constructor(options?: ErrorOptions) {
    super("email_already_registered", "Email is already registered", options);
  }
}

export class InvalidCredentials extends ApplicationError {
  constructor(options?: ErrorOptions) {
    super("invalid_credentials", "Invalid credentials", options);
  }
}

export class InvalidCurrentPassword extends ApplicationError {
  constructor(options?: ErrorOptions) {
    super("invalid_current_password", "Current password is incorrect", options);
  }
}

export class InvalidToken extends ApplicationError {
  constructor(options?: ErrorOptions) {
    super("invalid_token", "Invalid token", options);
  }
}

export class SpeechNotFound extends ApplicationError {
  constructor(options?: ErrorOptions) {
    super("speech_not_found", "Speech not found", options);
  }
}

export class InvalidAudio extends ApplicationError {
  constructor(message = "Invalid audio upload", options?: ErrorOptions) {
    super("invalid_audio", message, options);
  }
}

export class AnalysisQuotaReached extends ApplicationError {
  constructor(options?: ErrorOptions) {
    super("analysis_quota_reached", "Analysis quota reached.", options);
  }
}

/** Adapter-level signal translated into AnalysisQuotaReached by the use case. */
export class AnalysisQuotaExhausted extends Error {
  constructor(message = "Analysis provider quota exhausted", options?: ErrorOptions) {
    super(message, options);
    this.name = "AnalysisQuotaExhausted";
  }
}
