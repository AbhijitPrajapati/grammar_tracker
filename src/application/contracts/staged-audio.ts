import type { UserId } from "../../domain/user";
import { InvalidAudio } from "../errors";
import {
  isAllowedAudioExtension,
  type AllowedAudioExtension,
} from "./audio-format";

export const STAGED_AUDIO_ROOT = "speech-staging";
export const MAX_STAGED_AUDIO_BASENAME_LENGTH = 255;

// Ensure valid strings
const SAFE_OWNER_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const SAFE_BASENAME_CHARACTERS = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface ValidatedStagedAudioPath {
  readonly pathname: string;
  readonly basename: string;
  readonly extension: AllowedAudioExtension;
}

export interface StagedAudioReference {
  readonly pathname: string;
  readonly etag: string;
}

export function stagedAudioOwnerPrefix(userId: UserId): string {
  if (!SAFE_OWNER_SEGMENT.test(userId)) {
    throw new InvalidAudio("Invalid staged audio owner");
  }
  return `${STAGED_AUDIO_ROOT}/${userId}/`;
}

/** Builds the bounded per-user staging slot for one supported audio format. */
export function buildStagedAudioPathname(
  userId: UserId,
  extension: AllowedAudioExtension,
): string {
  if (!isAllowedAudioExtension(extension)) {
    throw new InvalidAudio("Unsupported staged audio filename extension");
  }
  return `${stagedAudioOwnerPrefix(userId)}audio.${extension}`;
}

export function validateStagedAudioBasename(
  basename: string,
): Pick<ValidatedStagedAudioPath, "basename" | "extension"> {
  if (
    typeof basename !== "string" ||
    basename.length === 0 ||
    basename.length > MAX_STAGED_AUDIO_BASENAME_LENGTH ||
    !SAFE_BASENAME_CHARACTERS.test(basename) ||
    basename.includes("..") ||
    basename.includes("/") ||
    basename.includes("\\")
  ) {
    throw new InvalidAudio("Invalid staged audio filename");
  }

  const separator = basename.lastIndexOf(".");
  const extension = basename.slice(separator + 1);
  if (
    separator <= 0 ||
    !isAllowedAudioExtension(extension) ||
    extension !== extension.toLowerCase()
  ) {
    throw new InvalidAudio("Unsupported staged audio filename extension");
  }

  return { basename, extension };
}

/** Enforces exact ownership and one fixed slot for each supported format. */
export function validateStagedAudioPathname(
  userId: UserId,
  pathname: string,
): ValidatedStagedAudioPath {
  if (typeof pathname !== "string") {
    throw new InvalidAudio("Invalid staged audio pathname");
  }

  const prefix = stagedAudioOwnerPrefix(userId);
  if (!pathname.startsWith(prefix)) {
    throw new InvalidAudio("Staged audio does not belong to this user");
  }

  const basename = pathname.slice(prefix.length);
  const validated = validateStagedAudioBasename(basename);
  if (
    pathname !== `${prefix}${validated.basename}` ||
    validated.basename !== `audio.${validated.extension}`
  ) {
    throw new InvalidAudio("Invalid staged audio pathname");
  }

  return { pathname, ...validated };
}
