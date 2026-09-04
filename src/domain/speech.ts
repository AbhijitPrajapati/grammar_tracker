import { Analysis } from "./analysis";
import type { UserId } from "./user";

export type SpeechId = string;

interface SpeechProperties {
  readonly id: SpeechId;
  readonly userId: UserId;
  readonly transcript: string;
  readonly analysis: Analysis;
  readonly createdAt: Date;
}

export class Speech implements SpeechProperties {
  readonly id: SpeechId;
  readonly userId: UserId;
  readonly transcript: string;
  readonly analysis: Analysis;
  readonly createdAt: Date;

  constructor(properties: SpeechProperties) {
    this.id = properties.id;
    this.userId = properties.userId;
    this.transcript = properties.transcript;
    this.analysis = properties.analysis;
    this.createdAt = new Date(properties.createdAt);
    Object.freeze(this);
  }
}
