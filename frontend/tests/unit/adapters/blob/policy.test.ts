import { describe, expect, it } from "vitest";

import { InvalidAudio } from "@/src/core/application/errors";
import {
  ALLOWED_AUDIO_CONTENT_TYPES,
  ALLOWED_AUDIO_EXTENSIONS,
  buildStagedAudioPathname,
  isAudioContentTypeAllowedForExtension,
  isOwnedStagedAudioPathname,
  MAX_STAGED_AUDIO_BYTES,
  stagedAudioOwnerPrefix,
  validateStagedAudioBasename,
  validateStagedAudioEtag,
  validateStagedAudioMetadata,
  validateStagedAudioPathname,
} from "@/src/core/application/contracts/staged-audio";
import { AudioSample } from "@/src/core/application/contracts/audio";

const USER_ID = "4fcd2c4d-c90b-4202-8b1f-f59cf95cced6";
const OTHER_USER_ID = "87509066-5ed7-4b44-ab47-d49d75b94f20";

describe("staged audio Blob policy", () => {
  it("exports the OpenAI transcription formats and the domain size limit", () => {
    expect(ALLOWED_AUDIO_EXTENSIONS).toEqual([
      "flac",
      "mp3",
      "mp4",
      "mpeg",
      "mpga",
      "m4a",
      "ogg",
      "wav",
      "webm",
    ]);
    expect(ALLOWED_AUDIO_CONTENT_TYPES).toContain("audio/webm");
    expect(ALLOWED_AUDIO_CONTENT_TYPES.every((type) => type.startsWith("audio/")))
      .toBe(true);
    expect(MAX_STAGED_AUDIO_BYTES).toBe(AudioSample.MAX_CONTENT_BYTES);
  });

  it("builds the exact authenticated-owner slot for a supported format", () => {
    expect(stagedAudioOwnerPrefix(USER_ID)).toBe(
      `speech-staging/${USER_ID}/`,
    );
    expect(buildStagedAudioPathname(USER_ID, "webm")).toBe(
      `speech-staging/${USER_ID}/audio.webm`,
    );
  });

  it.each([
    "../other.wav",
    "folder/recording.wav",
    "folder\\recording.wav",
    ".hidden.wav",
    "two..dots.wav",
    "space in name.wav",
    "recording.WAV",
    "recording.exe",
    "recording",
    "https://blob.example/recording.wav",
  ])("rejects the unsafe or unsupported basename %s", (basename) => {
    expect(() => validateStagedAudioBasename(basename)).toThrow(InvalidAudio);
  });

  it("accepts safe names for every supported extension", () => {
    for (const extension of ALLOWED_AUDIO_EXTENSIONS) {
      expect(validateStagedAudioBasename(`recording.${extension}`)).toEqual({
        basename: `recording.${extension}`,
        extension,
      });
    }
  });

  it("enforces exact ownership instead of accepting prefix collisions", () => {
    const owned = buildStagedAudioPathname(USER_ID, "wav");
    const other = buildStagedAudioPathname(OTHER_USER_ID, "wav");
    const collision = `speech-staging/${USER_ID}-other/audio.wav`;

    expect(isOwnedStagedAudioPathname(USER_ID, owned)).toBe(true);
    expect(isOwnedStagedAudioPathname(USER_ID, other)).toBe(false);
    expect(isOwnedStagedAudioPathname(USER_ID, collision)).toBe(false);
    expect(() => validateStagedAudioPathname(USER_ID, other)).toThrow(
      /does not belong/,
    );
  });

  it("rejects URLs and nested pathnames even when they mention the owner", () => {
    expect(() =>
      validateStagedAudioPathname(
        USER_ID,
        `https://example.test/speech-staging/${USER_ID}/audio.wav`,
      ),
    ).toThrow(InvalidAudio);
    expect(() =>
      validateStagedAudioPathname(
        USER_ID,
        `speech-staging/${USER_ID}/nested/audio.wav`,
      ),
    ).toThrow(InvalidAudio);
    expect(() =>
      validateStagedAudioPathname(
        USER_ID,
        `speech-staging/${USER_ID}/another-name.wav`,
      ),
    ).toThrow(InvalidAudio);
  });

  it("requires the content type to match both the allowlist and extension", () => {
    expect(isAudioContentTypeAllowedForExtension("m4a", "audio/x-m4a")).toBe(
      true,
    );
    expect(isAudioContentTypeAllowedForExtension("mp3", "audio/mpeg")).toBe(
      true,
    );
    expect(isAudioContentTypeAllowedForExtension("wav", "audio/mpeg")).toBe(
      false,
    );
    expect(isAudioContentTypeAllowedForExtension("webm", "video/webm")).toBe(
      false,
    );
  });

  it("treats an ETag as opaque while rejecting empty or unsafe header values", () => {
    expect(validateStagedAudioEtag('W/"opaque-value"')).toBe(
      'W/"opaque-value"',
    );
    expect(() => validateStagedAudioEtag("")).toThrow(InvalidAudio);
    expect(() => validateStagedAudioEtag("value with spaces")).toThrow(
      InvalidAudio,
    );
    expect(() => validateStagedAudioEtag("value\r\nheader: injected")).toThrow(
      InvalidAudio,
    );
  });

  it("validates Blob metadata against the opaque pathname and ETag", () => {
    const pathname = buildStagedAudioPathname(USER_ID, "webm");

    expect(
      validateStagedAudioMetadata(USER_ID, pathname, "etag-one", {
        pathname,
        etag: "etag-one",
        size: MAX_STAGED_AUDIO_BYTES,
        contentType: "audio/webm",
      }),
    ).toMatchObject({
      pathname,
      basename: "audio.webm",
      extension: "webm",
      etag: "etag-one",
      size: MAX_STAGED_AUDIO_BYTES,
      contentType: "audio/webm",
    });
  });

  it.each([
    ["changed pathname", { pathname: "speech-staging/wrong/file.webm" }],
    ["changed ETag", { etag: "etag-two" }],
    ["an empty file", { size: 0 }],
    ["an oversized file", { size: MAX_STAGED_AUDIO_BYTES + 1 }],
    ["a fractional size", { size: 1.5 }],
    ["a non-audio MIME type", { contentType: "video/webm" }],
    ["a MIME/extension mismatch", { contentType: "audio/mpeg" }],
  ])("rejects metadata containing %s", (_case, override) => {
    const pathname = buildStagedAudioPathname(USER_ID, "webm");
    expect(() =>
      validateStagedAudioMetadata(USER_ID, pathname, "etag-one", {
        pathname,
        etag: "etag-one",
        size: 1_024,
        contentType: "audio/webm",
        ...override,
      }),
    ).toThrow(InvalidAudio);
  });
});
