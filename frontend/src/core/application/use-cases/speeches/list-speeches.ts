import type { Speech, SpeechRepository } from "../../../domain/speech";
import type { UserId } from "../../../domain/user";

export class ListSpeeches {
  constructor(private readonly speeches: SpeechRepository) {}

  execute(
    userId: UserId,
    limit = 100,
    offset = 0,
  ): Promise<readonly Speech[]> {
    return this.speeches.list(userId, limit, offset);
  }
}
