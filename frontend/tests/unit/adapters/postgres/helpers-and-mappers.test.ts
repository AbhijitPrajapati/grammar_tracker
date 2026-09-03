import { describe, expect, it } from "vitest";

import {
  hasPostgresSqlState,
  mistakeCategoryFromDatabase,
  parsePostgresInteger,
} from "@/src/adapters/outbound/postgres/helpers";
import {
  speechFromRow,
  storedUserFromRow,
} from "@/src/adapters/outbound/postgres/mappers";

const CREATED_AT = new Date("2026-01-10T12:00:00.000Z");

describe("PostgreSQL scalar mapping", () => {
  it("converts pg int8 strings without losing precision", () => {
    expect(parsePostgresInteger("0")).toBe(0);
    expect(parsePostgresInteger("-42")).toBe(-42);
    expect(parsePostgresInteger(BigInt(27))).toBe(27);
    expect(parsePostgresInteger(9)).toBe(9);
    expect(parsePostgresInteger(String(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it("rejects malformed and unsafe aggregate values", () => {
    expect(() => parsePostgresInteger("1.5")).toThrow(TypeError);
    expect(() => parsePostgresInteger(null)).toThrow(TypeError);
    expect(() =>
      parsePostgresInteger(
        (BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)).toString(),
      ),
    ).toThrow(RangeError);
  });

  it("finds only an exact SQLSTATE through Drizzle's cause wrapper", () => {
    const uniqueViolation = {
      cause: { code: "23505", message: "duplicate key" },
    };
    expect(hasPostgresSqlState(uniqueViolation, "23505")).toBe(true);
    expect(hasPostgresSqlState({ code: "23503" }, "23505")).toBe(false);
    expect(hasPostgresSqlState(new Error("23505"), "23505")).toBe(false);
  });

  it("validates category strings read from the unconstrained varchar", () => {
    expect(mistakeCategoryFromDatabase("verb_tense")).toBe("verb_tense");
    expect(() => mistakeCategoryFromDatabase("invented_category")).toThrow(
      /Unknown mistake category/,
    );
  });
});

describe("PostgreSQL entity mapping", () => {
  it("keeps credential material outside the user domain object", () => {
    const stored = storedUserFromRow({
      id: "4fcd2c4d-c90b-4202-8b1f-f59cf95cced6",
      email: "Learner@Example.COM",
      passwordHash: "argon2-hash",
      createdAt: CREATED_AT,
    });

    expect(stored.account.email.value).toBe("learner@example.com");
    expect(stored.account.createdAt).toEqual(CREATED_AT);
    expect(stored.passwordHash).toBe("argon2-hash");
    expect("passwordHash" in stored.account).toBe(false);
  });

  it("hydrates a speech from the sole live v2 JSONB document", () => {
    const speech = speechFromRow({
      id: "b8742aa2-bc1a-4ad4-8746-9d6b905431f0",
      userId: "4fcd2c4d-c90b-4202-8b1f-f59cf95cced6",
      transcript: "I go yesterday.",
      createdAt: CREATED_AT,
      analysis: {
        schema_version: 2,
        mistakes: [
          {
            category: "verb_tense",
            original_text: "go",
            correction: "went",
            explanation: "Use past tense.",
          },
        ],
        frequencies: [
          { category: "verb_tense", occurrences: 1, opportunities: 1 },
        ],
        feedback: "Review past tense.",
      },
    });

    expect(speech.analysis.mistakes[0]?.originalText).toBe("go");
    expect(speech.analysis.frequencies[0]?.occurrences).toBe(1);
    expect(speech.createdAt).toEqual(CREATED_AT);
  });
});
