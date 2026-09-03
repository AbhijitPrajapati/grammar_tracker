import { and, desc, eq } from "drizzle-orm";

import type { Analysis } from "@/src/domain/analysis";
import type { SpeechRepository } from "@/src/application/ports/repositories";
import type { Speech, SpeechId } from "@/src/domain/speech";
import type { UserId } from "@/src/domain/user";

import { analysisToDocument } from "./analysis-document";
import { getDatabase } from "./client";
import { speechFromRow } from "./mappers";
import { mistakeFrequencies, speeches } from "./schema";

type Database = ReturnType<typeof getDatabase>;

export class PostgresSpeechRepository implements SpeechRepository {
  constructor(private readonly database: Database = getDatabase()) {}

  async create(
    userId: UserId,
    transcript: string,
    analysis: Analysis,
  ): Promise<Speech> {
    return this.database.transaction(async (transaction) => {
      const [row] = await transaction
        .insert(speeches)
        .values({
          userId,
          transcript,
          analysis: analysisToDocument(analysis),
        })
        .returning();
      if (row === undefined) {
        throw new Error("Creating a speech returned no row");
      }

      if (analysis.frequencies.length > 0) {
        await transaction.insert(mistakeFrequencies).values(
          analysis.frequencies.map((frequency) => ({
            speechId: row.id,
            category: frequency.category,
            occurrences: frequency.occurrences,
            opportunities: frequency.opportunities,
          })),
        );
      }

      return speechFromRow(row);
    });
  }

  async list(
    userId: UserId,
    limit: number,
    offset: number,
  ): Promise<readonly Speech[]> {
    const rows = await this.database
      .select()
      .from(speeches)
      .where(eq(speeches.userId, userId))
      .orderBy(desc(speeches.createdAt))
      .offset(offset)
      .limit(limit);
    return rows.map(speechFromRow);
  }

  async deleteOwned(speechId: SpeechId, userId: UserId): Promise<boolean> {
    const deleted = await this.database
      .delete(speeches)
      .where(and(eq(speeches.id, speechId), eq(speeches.userId, userId)))
      .returning({ id: speeches.id });
    return deleted.length > 0;
  }
}
