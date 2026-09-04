import { and, asc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import type {
  DateRange,
  Distribution,
  TimeBucket,
  TimeSeries,
} from "@/src/domain/analytics";
import type { AnalyticsReader } from "@/src/application/ports/repositories";
import { CategoryFrequency, type MistakeCategory } from "@/src/domain/analysis";
import type { UserId } from "@/src/domain/user";

import { PostgresDatabase } from "./client";
import { mistakeCategoryFromDatabase, parsePostgresInteger } from "./util";
import { mistakeFrequencies, speeches } from "./schema";

// Common filter condition: user ownership + in time range
function speechScope(userId: UserId, dateRange: DateRange): SQL {
  const predicates: SQL[] = [eq(speeches.userId, userId)];
  if (dateRange.start !== null) {
    predicates.push(gte(speeches.createdAt, dateRange.start));
  }
  if (dateRange.end !== null) {
    predicates.push(lte(speeches.createdAt, dateRange.end));
  }
  return and(...predicates)!;
}

function bucketLiteral(bucket: TimeBucket): SQL {
  // Literals avoid duplicate bind parameters between SELECT and GROUP BY
  switch (bucket) {
    case "day":
      return sql.raw("'day'");
    case "week":
      return sql.raw("'week'");
    case "month":
      return sql.raw("'month'");
    case "year":
      return sql.raw("'year'");
  }
}

export class PostgresAnalyticsReader implements AnalyticsReader {
  constructor(private readonly database: PostgresDatabase) {}

  async distribution(
    userId: UserId,
    dateRange: DateRange,
  ): Promise<Distribution> {
    const scope = speechScope(userId, dateRange);

    const [totalRow] = await this.database
      .select({ total: sql<unknown>`count(${speeches.id})` })
      .from(speeches)
      .where(scope);
    if (totalRow === undefined) {
      throw new Error("Counting speeches returned no row");
    }

    const rows = await this.database
      .select({
        category: mistakeFrequencies.category,
        occurrences: sql<unknown>`sum(${mistakeFrequencies.occurrences})`,
        opportunities: sql<unknown>`sum(${mistakeFrequencies.opportunities})`,
      })
      .from(mistakeFrequencies)
      .innerJoin(speeches, eq(mistakeFrequencies.speechId, speeches.id))
      .where(scope)
      .groupBy(mistakeFrequencies.category);

    return {
      mistakeFrequencies: rows.map(
        (row) =>
          new CategoryFrequency({
            category: mistakeCategoryFromDatabase(row.category),
            occurrences: parsePostgresInteger(
              row.occurrences,
              "distribution occurrences",
            ),
            opportunities: parsePostgresInteger(
              row.opportunities,
              "distribution opportunities",
            ),
          }),
      ),
      totalSpeeches: parsePostgresInteger(totalRow.total, "speech count"),
    };
  }

  async timeSeries(
    userId: UserId,
    dateRange: DateRange,
    mistakeCategory: MistakeCategory,
    bucket: TimeBucket,
  ): Promise<TimeSeries> {
    const time =
      sql<Date>`date_trunc(${bucketLiteral(bucket)}, ${speeches.createdAt})`.mapWith(
        speeches.createdAt,
      );

    const rows = await this.database
      .select({
        time,
        occurrences: sql<unknown>`sum(${mistakeFrequencies.occurrences})`,
        opportunities: sql<unknown>`sum(${mistakeFrequencies.opportunities})`,
      })
      .from(mistakeFrequencies)
      .innerJoin(speeches, eq(mistakeFrequencies.speechId, speeches.id))
      .where(
        and(
          eq(mistakeFrequencies.category, mistakeCategory),
          speechScope(userId, dateRange),
        ),
      )
      .groupBy(time)
      .orderBy(asc(time));

    return {
      points: rows.map((row) => ({
        time: row.time,
        occurrences: parsePostgresInteger(
          row.occurrences,
          "time-series occurrences",
        ),
        opportunities: parsePostgresInteger(
          row.opportunities,
          "time-series opportunities",
        ),
      })),
    };
  }
}
