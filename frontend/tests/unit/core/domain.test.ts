import assert from "node:assert/strict";
import { describe, it } from "vitest";

import {
  Analysis,
  CategoryFrequency,
  DateRange,
  EmailAddress,
  Mistake,
  NewPassword,
  errorRate,
  timeBucketFor,
} from "../../../src/core/domain";
import {
  AudioSample,
  InvalidAudio,
} from "../../../src/core/application";

describe("grammar analysis domain", () => {
  it("preserves a valid immutable analysis", () => {
    const analysis = new Analysis({
      mistakes: [
        new Mistake({
          category: "verb_tense",
          originalText: "I go yesterday",
          correction: "I went yesterday",
          explanation: "A completed past action needs past tense.",
        }),
      ],
      frequencies: [
        new CategoryFrequency({
          category: "verb_tense",
          occurrences: 1,
          opportunities: 2,
        }),
      ],
      feedback: "Keep practicing past tense.",
    });

    assert.equal(analysis.mistakes[0]?.correction, "I went yesterday");
    assert.equal(errorRate(analysis.frequencies[0]!), 0.5);
    assert.equal(Object.isFrozen(analysis), true);
    assert.equal(Object.isFrozen(analysis.mistakes), true);
  });

  it("rejects invalid frequency counts", () => {
    assert.throws(
      () =>
        new CategoryFrequency({
          category: "plurality",
          occurrences: -1,
          opportunities: 1,
        }),
      /Frequency counts cannot be negative/,
    );
    assert.throws(
      () =>
        new CategoryFrequency({
          category: "plurality",
          occurrences: 2,
          opportunities: 1,
        }),
      /Occurrences cannot exceed opportunities/,
    );
  });

  it("requires unique frequencies and coverage for detected mistakes", () => {
    const duplicate = {
      category: "article_usage" as const,
      occurrences: 0,
      opportunities: 1,
    };
    assert.throws(
      () =>
        new Analysis({
          mistakes: [],
          frequencies: [duplicate, duplicate],
          feedback: "",
        }),
      /unique by category/,
    );
    assert.throws(
      () =>
        new Analysis({
          mistakes: [
            {
              category: "word_order",
              originalText: "Always I go",
              correction: "I always go",
              explanation: "Place the adverb after the subject.",
            },
          ],
          frequencies: [],
          feedback: "",
        }),
      /requires a category frequency/,
    );
  });

  it("uses a zero error rate when there were no opportunities", () => {
    assert.equal(errorRate({ occurrences: 0, opportunities: 0 }), 0);
  });
});

describe("account value objects", () => {
  it("normalizes email addresses consistently", () => {
    const email = new EmailAddress("  Learner@Example.COM ");
    assert.equal(email.value, "learner@example.com");
    assert.equal(email.toString(), email.value);
  });

  it("rejects malformed email addresses", () => {
    assert.throws(() => new EmailAddress("no-at-sign.example.com"));
    assert.throws(() => new EmailAddress("@example.com"));
    assert.throws(() => new EmailAddress("learner@example"));
  });

  it("enforces the inclusive password length boundaries", () => {
    assert.equal(new NewPassword("12345678").value, "12345678");
    assert.equal(new NewPassword("x".repeat(128)).value.length, 128);
    assert.throws(() => new NewPassword("1234567"));
    assert.throws(() => new NewPassword("x".repeat(129)));
  });
});

describe("audio contract", () => {
  const streamFrom = (bytes: Uint8Array) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });

  it("validates metadata and supplies a fresh stream for every open", async () => {
    let opens = 0;
    const sample = new AudioSample({
      sizeBytes: 3,
      filename: "sample.webm",
      mediaType: "audio/webm",
      openStream: async () => {
        opens += 1;
        return streamFrom(new Uint8Array([1, 2, 3]));
      },
    });

    const first = await sample.openStream();
    const second = await sample.openStream();
    assert.notEqual(first, second);
    assert.equal(opens, 2);
    assert.equal(sample.sizeBytes, 3);
  });

  it("enforces the audio content contract", () => {
    const valid = {
      sizeBytes: 1,
      filename: "sample.ogg",
      mediaType: "audio/ogg",
      openStream: async () => streamFrom(new Uint8Array([1])),
    };

    assert.throws(
      () => new AudioSample({ ...valid, sizeBytes: 0 }),
      InvalidAudio,
    );
    assert.throws(
      () =>
        new AudioSample({
          ...valid,
          sizeBytes: AudioSample.MAX_CONTENT_BYTES + 1,
        }),
      /25 MiB/,
    );
    assert.throws(
      () => new AudioSample({ ...valid, mediaType: "video/webm" }),
      /audio content type/,
    );
    assert.throws(
      () => new AudioSample({ ...valid, filename: "" }),
      /audio filename/,
    );
  });
});

describe("analytics date policy", () => {
  const start = new Date("2026-01-01T00:00:00.000Z");
  const rangeForDays = (days: number, extraHours = 0) =>
    new DateRange({
      start,
      end: new Date(
        start.getTime() + days * 24 * 60 * 60 * 1_000 + extraHours * 60 * 60 * 1_000,
      ),
    });

  it("uses the required day/week/month/year thresholds", () => {
    assert.equal(timeBucketFor(rangeForDays(14, 23)), "day");
    assert.equal(timeBucketFor(rangeForDays(15)), "week");
    assert.equal(timeBucketFor(rangeForDays(90, 23)), "week");
    assert.equal(timeBucketFor(rangeForDays(91)), "month");
    assert.equal(timeBucketFor(rangeForDays(730, 23)), "month");
    assert.equal(timeBucketFor(rangeForDays(731)), "year");
    assert.equal(timeBucketFor(new DateRange()), "month");
    assert.equal(timeBucketFor(new DateRange({ start })), "month");
  });

  it("rejects reversed or invalid boundaries", () => {
    assert.throws(
      () => new DateRange({ start: rangeForDays(1).end, end: start }),
      /start must not be after/,
    );
    assert.throws(
      () => new DateRange({ start: new Date(Number.NaN) }),
      /valid date/,
    );
  });
});
