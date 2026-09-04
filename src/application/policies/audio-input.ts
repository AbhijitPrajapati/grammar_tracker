export const MAX_AUDIO_INPUT_BYTES = 25 * 1024 * 1024;

// Extensions allowed by speech-analysis
export const ALLOWED_AUDIO_EXTENSIONS = [
  "flac",
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "m4a",
  "ogg",
  "wav",
  "webm",
] as const;

export type AllowedAudioExtension = (typeof ALLOWED_AUDIO_EXTENSIONS)[number];

// MIME types for the allowed extensions
export const ALLOWED_AUDIO_CONTENT_TYPES = [
  "audio/flac",
  "audio/x-flac",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/ogg",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/webm",
] as const;

export type AllowedAudioContentType =
  (typeof ALLOWED_AUDIO_CONTENT_TYPES)[number];

const CONTENT_TYPES_BY_EXTENSION: Readonly<
  Record<AllowedAudioExtension, readonly AllowedAudioContentType[]>
> = {
  flac: ["audio/flac", "audio/x-flac"],
  mp3: ["audio/mpeg", "audio/mp3"],
  mp4: ["audio/mp4"],
  mpeg: ["audio/mpeg"],
  mpga: ["audio/mpeg"],
  m4a: ["audio/mp4", "audio/x-m4a"],
  ogg: ["audio/ogg"],
  wav: ["audio/wav", "audio/wave", "audio/x-wav"],
  webm: ["audio/webm"],
};

export function isAllowedAudioExtension(
  value: string,
): value is AllowedAudioExtension {
  return (ALLOWED_AUDIO_EXTENSIONS as readonly string[]).includes(value);
}

export function isAllowedAudioContentType(
  value: string,
): value is AllowedAudioContentType {
  return (ALLOWED_AUDIO_CONTENT_TYPES as readonly string[]).includes(value);
}

export function isAudioContentTypeAllowedForExtension(
  extension: AllowedAudioExtension,
  contentType: string,
): contentType is AllowedAudioContentType {
  return CONTENT_TYPES_BY_EXTENSION[extension].includes(
    contentType as AllowedAudioContentType,
  );
}
