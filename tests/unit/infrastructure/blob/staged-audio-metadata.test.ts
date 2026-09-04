import { describe, expect, it } from "vitest";

import { MAX_STAGED_AUDIO_BYTES } from "@/src/application/contracts/audio-format";
import { buildStagedAudioPathname } from "@/src/application/contracts/staged-audio";
import { InvalidAudio } from "@/src/application/errors";
import {
  validateStagedAudioEtag,
  validateStagedAudioMetadata,
} from "@/src/infrastructure/blob/staged-audio-metadata";

const USER_ID = "4fcd2c4d-c90b-4202-8b1f-f59cf95cced6";

describe("staged audio Blob metadata", () => {
  it("treats an ETag as opaque while rejecting unsafe values", () => {
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

  it("validates Blob metadata against the pathname and ETag", () => {
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
