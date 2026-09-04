import type { UserId } from "../../domain/user";
import { InvalidAudio } from "../errors";
import {
  isAllowedAudioExtension,
  type AllowedAudioExtension,
} from "./audio-input";

const STAGED_AUDIO_ROOT = "speech-staging";
const SAFE_OWNER_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const STAGED_AUDIO_BASENAME = /^audio\.([a-z0-9]+)$/;

export interface ValidatedStagedAudioPath {
  readonly pathname: string;
  readonly basename: string;
  readonly extension: AllowedAudioExtension;
}

function stagedAudioOwnerPrefix(userId: UserId): string {
  if (!SAFE_OWNER_SEGMENT.test(userId)) {
    throw new InvalidAudio("Invalid staged audio owner");
  }
  return `${STAGED_AUDIO_ROOT}/${userId}/`;
}

// Constructs the per-user staging slot for one supported audio format
export function buildStagedAudioPathname(
  userId: UserId,
  extension: AllowedAudioExtension,
): string {
  if (!isAllowedAudioExtension(extension)) {
    throw new InvalidAudio("Unsupported staged audio filename extension");
  }
  return `${stagedAudioOwnerPrefix(userId)}audio.${extension}`;
}

// Enforces ownership and one fixed slot for each supported format
export function validateStagedAudioPathname(
  userId: UserId,
  pathname: string,
): ValidatedStagedAudioPath {
  if (typeof pathname !== "string") {
    throw new InvalidAudio("Invalid staged audio pathname");
  }

  // Verify that the prefix matches the userId
  const prefix = stagedAudioOwnerPrefix(userId);
  if (!pathname.startsWith(prefix)) {
    throw new InvalidAudio("Staged audio does not belong to this user");
  }

  const basename = pathname.slice(prefix.length);
  const match = STAGED_AUDIO_BASENAME.exec(basename);
  const extension = match?.[1] ?? "";
  if (!isAllowedAudioExtension(extension)) {
    throw new InvalidAudio("Invalid staged audio pathname");
  }

  return { pathname, basename, extension };
}
