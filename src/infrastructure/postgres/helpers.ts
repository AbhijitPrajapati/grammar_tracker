import type { MistakeCategory } from "@/src/domain/analysis";
import { MISTAKE_CATEGORIES } from "@/src/domain/analysis";

const MIN_SAFE_INTEGER = BigInt(Number.MIN_SAFE_INTEGER);
const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * PostgreSQL returns int8 aggregates as strings by default. Convert without
 * silently rounding values outside JavaScript's safe-integer range.
 */
export function parsePostgresInteger(
  value: unknown,
  fieldName = "PostgreSQL integer",
): number {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError(`${fieldName} is outside the safe-integer range`);
    }
    return value;
  }

  let integer: bigint;
  if (typeof value === "bigint") {
    integer = value;
  } else if (typeof value === "string" && /^-?\d+$/.test(value)) {
    integer = BigInt(value);
  } else {
    throw new TypeError(`${fieldName} is not an integer`);
  }

  if (integer < MIN_SAFE_INTEGER || integer > MAX_SAFE_INTEGER) {
    throw new RangeError(`${fieldName} is outside the safe-integer range`);
  }
  return Number(integer);
}

/** Finds a SQLSTATE on either a driver error or Drizzle's error wrapper. */
export function hasPostgresSqlState(error: unknown, sqlState: string): boolean {
  const visited = new Set<object>();
  let candidate: unknown = error;

  while (typeof candidate === "object" && candidate !== null) {
    if (visited.has(candidate)) return false;
    visited.add(candidate);

    if (
      "code" in candidate &&
      typeof candidate.code === "string" &&
      candidate.code === sqlState
    ) {
      return true;
    }

    candidate = "cause" in candidate ? candidate.cause : null;
  }
  return false;
}

export function mistakeCategoryFromDatabase(value: string): MistakeCategory {
  if (!(MISTAKE_CATEGORIES as readonly string[]).includes(value)) {
    throw new TypeError(`Unknown mistake category in database: ${value}`);
  }
  return value as MistakeCategory;
}
