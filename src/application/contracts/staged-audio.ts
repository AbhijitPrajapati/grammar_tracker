// Central interface for staged audio references
export interface StagedAudioReference {
  readonly pathname: string;
  readonly etag: string;
}
