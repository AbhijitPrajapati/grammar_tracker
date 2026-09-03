import { describe, expect, it } from "vitest";

import { dateRangeFor } from "@/src/adapters/inbound/next/queries/analytics";
import {
  authFormSchema,
  dateRangeSelectionSchema,
  fieldErrors,
  mistakeCategorySchema,
  passwordChangeSchema,
  speechIdSchema,
  stagedAudioReferenceSchema,
} from "@/src/adapters/inbound/next/validation";

const NOW = new Date("2026-09-02T17:30:00.000Z");

describe("server action validation", () => {
  it("accepts the two authentication intents and the fixed password bounds", () => {
    expect(
      authFormSchema.parse({
        mode: "login",
        email: "learner@example.com",
        password: "12345678",
      }),
    ).toEqual({
      mode: "login",
      email: "learner@example.com",
      password: "12345678",
    });

    expect(
      authFormSchema.safeParse({
        mode: "forgot-password",
        email: "learner@example.com",
        password: "12345678",
      }).success,
    ).toBe(false);
    expect(
      authFormSchema.safeParse({
        mode: "register",
        email: "not-an-email",
        password: "12345678",
      }).success,
    ).toBe(false);
    expect(
      authFormSchema.safeParse({
        mode: "register",
        email: "learner@example.com",
        password: "1234567",
      }).success,
    ).toBe(false);
  });

  it("counts Unicode code points consistently with the domain password rule", () => {
    const eightCodePoints = "😀".repeat(8);
    expect(
      authFormSchema.safeParse({
        mode: "register",
        email: "learner@example.com",
        password: eightCodePoints,
      }).success,
    ).toBe(true);
  });

  it("requires matching new-password confirmation", () => {
    const result = passwordChangeSchema.safeParse({
      currentPassword: "old-password",
      newPassword: "new-password",
      confirmation: "different-password",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error)).toEqual({
        confirmation: ["New passwords do not match."],
      });
    }
  });

  it("validates opaque IDs and staged references before use cases run", () => {
    expect(
      speechIdSchema.safeParse("b8742aa2-bc1a-4ad4-8746-9d6b905431f0").success,
    ).toBe(true);
    expect(speechIdSchema.safeParse("not-a-uuid").success).toBe(false);

    expect(
      stagedAudioReferenceSchema.safeParse({
        pathname:
          "speech-staging/4fcd2c4d-c90b-4202-8b1f-f59cf95cced6/practice.webm",
        etag: "opaque-etag",
      }).success,
    ).toBe(true);
    expect(
      stagedAudioReferenceSchema.safeParse({
        pathname: "",
        etag: "opaque-etag",
      }).success,
    ).toBe(false);
  });

  it("defaults invalid filter values while accepting only known categories", () => {
    expect(dateRangeSelectionSchema.parse(undefined)).toBe("monthly");
    expect(dateRangeSelectionSchema.parse("unexpected")).toBe("monthly");
    expect(dateRangeSelectionSchema.parse("all_time")).toBe("all_time");
    expect(mistakeCategorySchema.parse("plurality")).toBe("plurality");
    expect(mistakeCategorySchema.safeParse("invented").success).toBe(false);
  });
});

describe("analytics filter date ranges", () => {
  it.each([
    ["weekly", 7],
    ["monthly", 30],
    ["yearly", 365],
  ] as const)("maps %s to the existing rolling %d-day window", (selection, days) => {
    const range = dateRangeFor(selection, NOW);

    expect(range.end?.toISOString()).toBe(NOW.toISOString());
    expect(range.start?.toISOString()).toBe(
      new Date(NOW.getTime() - days * 24 * 60 * 60 * 1_000).toISOString(),
    );
  });

  it("keeps all-time analytics unbounded on both sides", () => {
    const range = dateRangeFor("all_time", NOW);
    expect(range.start).toBeNull();
    expect(range.end).toBeNull();
  });
});
