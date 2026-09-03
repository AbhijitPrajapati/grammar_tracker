import "server-only";

import pino, { type Logger } from "pino";

import { getServerEnvironment } from "../config/env";

let logger: Logger | undefined;

export function getLogger(): Logger {
  logger ??= pino({
    level: getServerEnvironment().logLevel,
    base: undefined,
    redact: {
      paths: [
        "password",
        "currentPassword",
        "newPassword",
        "token",
        "session",
        "audio",
        "transcript",
        "req.headers.cookie",
        "req.headers.authorization",
      ],
      censor: "[REDACTED]",
    },
  });
  return logger;
}
