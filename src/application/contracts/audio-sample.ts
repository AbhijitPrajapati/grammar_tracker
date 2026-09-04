import { InvalidAudio } from "../errors";
import { MAX_AUDIO_INPUT_BYTES } from "../policies/audio-input";

export interface AudioSampleProperties {
  readonly sizeBytes: number;
  readonly filename: string | null;
  readonly mediaType: string | null;
  readonly openStream: () => Promise<ReadableStream<Uint8Array>>;
}

// Represents the audio sample itself
export class AudioSample implements AudioSampleProperties {
  static readonly MAX_CONTENT_BYTES = MAX_AUDIO_INPUT_BYTES;

  readonly sizeBytes: number;
  readonly filename: string;
  readonly mediaType: string;
  private readonly streamFactory: () => Promise<ReadableStream<Uint8Array>>;

  constructor(properties: AudioSampleProperties) {
    if (properties.sizeBytes <= 0) {
      throw new InvalidAudio("Audio must not be empty");
    }
    if (properties.sizeBytes > AudioSample.MAX_CONTENT_BYTES) {
      throw new InvalidAudio("Audio must be no larger than 25 MiB");
    }
    if (
      properties.mediaType === null ||
      !properties.mediaType.startsWith("audio/")
    ) {
      throw new InvalidAudio("An audio content type is required");
    }
    if (!properties.filename) {
      throw new InvalidAudio("An audio filename is required");
    }

    this.sizeBytes = properties.sizeBytes;
    this.filename = properties.filename;
    this.mediaType = properties.mediaType;
    this.streamFactory = properties.openStream;
    Object.freeze(this);
  }

  /** A fresh stream is returned for each deliberate provider attempt or retry. */
  openStream(): Promise<ReadableStream<Uint8Array>> {
    return this.streamFactory();
  }
}
