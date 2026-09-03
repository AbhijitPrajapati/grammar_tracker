import "server-only";

import {
  AnalysisQuotaReached,
  ApplicationError,
  EmailAlreadyRegistered,
  InvalidAudio,
  InvalidCredentials,
  InvalidCurrentPassword,
  SpeechNotFound,
} from "@/src/core/application/errors";
import { getLogger } from "@/src/adapters/outbound/observability/logger";
import type { ActionState } from "./action-state";

export function actionError(
  error: unknown,
  operation: string,
  fallbackMessage: string,
): ActionState<never> {
  if (error instanceof EmailAlreadyRegistered) {
    return failure("Email is already registered");
  }
  if (error instanceof InvalidCredentials) {
    return failure("Invalid credentials");
  }
  if (error instanceof InvalidCurrentPassword) {
    return failure("Current password is incorrect");
  }
  if (error instanceof AnalysisQuotaReached) {
    return failure("Analysis quota reached");
  }
  if (error instanceof InvalidAudio) {
    return failure(error.message);
  }
  if (error instanceof SpeechNotFound) {
    return failure("Speech not found");
  }
  if (error instanceof ApplicationError) {
    return failure(error.message);
  }

  getLogger().error(
    {
      operation,
      errorType: error instanceof Error ? error.name : "UnknownError",
    },
    "Server action failed",
  );
  return failure(fallbackMessage);
}

function failure(message: string): ActionState<never> {
  return { status: "error", message };
}
