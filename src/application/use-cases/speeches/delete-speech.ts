import { SpeechNotFound } from "../../errors";
import type { SpeechRepository } from "../../ports/repositories";
import type { SpeechId } from "../../../domain/speech";
import type { UserId } from "../../../domain/user";

export class DeleteSpeech {
  constructor(private readonly speeches: SpeechRepository) {}

  async execute(speechId: SpeechId, userId: UserId): Promise<void> {
    if (!(await this.speeches.deleteOwned(speechId, userId))) {
      throw new SpeechNotFound();
    }
  }
}
