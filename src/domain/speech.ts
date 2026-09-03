import { Analysis, type AnalysisProperties } from "./analysis";
import type { UserId } from "./user";

export type SpeechId = string;

export interface SpeechProperties {
  readonly id: SpeechId;
  readonly userId: UserId;
  readonly transcript: string;
  readonly analysis: Analysis | AnalysisProperties;
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
    this.analysis =
      properties.analysis instanceof Analysis
        ? properties.analysis
        : new Analysis(properties.analysis);
    this.createdAt = new Date(properties.createdAt);
    Object.freeze(this);
  }
}
