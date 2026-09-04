import { describe, expect, it } from "vitest";

import { AudioSample } from "@/src/application/contracts/audio";
import {
  ALLOWED_AUDIO_CONTENT_TYPES,
  ALLOWED_AUDIO_EXTENSIONS,
  isAudioContentTypeAllowedForExtension,
  MAX_STAGED_AUDIO_BYTES,
} from "@/src/application/contracts/audio-format";
import {
  buildStagedAudioPathname,
  stagedAudioOwnerPrefix,
  validateStagedAudioBasename,
  validateStagedAudioPathname,
} from "@/src/application/contracts/staged-audio";
import { InvalidAudio } from "@/src/application/errors";

const USER_ID = "4fcd2c4d-c90b-4202-8b1f-f59cf95cced6";
const OTHER_USER_ID = "87509066-5ed7-4b44-ab47-d49d75b94f20";

describe("staged audio policy", () => {
  it("exports the OpenAI transcription formats and the audio size limit", () => {
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
    expect(
      ALLOWED_AUDIO_CONTENT_TYPES.every((type) => type.startsWith("audio/")),
    ).toBe(true);
    expect(MAX_STAGED_AUDIO_BYTES).toBe(AudioSample.MAX_CONTENT_BYTES);
  });

  it("builds the exact authenticated-owner slot for a supported format", () => {
    expect(stagedAudioOwnerPrefix(USER_ID)).toBe(`speech-staging/${USER_ID}/`);
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

    expect(validateStagedAudioPathname(USER_ID, owned).pathname).toBe(owned);
    expect(() => validateStagedAudioPathname(USER_ID, other)).toThrow(
      /does not belong/,
    );
    expect(() => validateStagedAudioPathname(USER_ID, collision)).toThrow(
      /does not belong/,
    );
  });

  it("rejects URLs, nested paths, and alternate filenames", () => {
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

  it("requires the content type to match the extension", () => {
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
});
