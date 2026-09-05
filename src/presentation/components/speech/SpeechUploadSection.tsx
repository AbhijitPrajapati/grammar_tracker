"use client";

import { uploadPresigned } from "@vercel/blob/client";
import { useState, useTransition, type FormEvent } from "react";

import { SpeechResultCard } from "@/src/presentation/components/speech/SpeechResultCard";
import { Button } from "@/src/presentation/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/presentation/components/ui/card";
import { Input } from "@/src/presentation/components/ui/input";
import { Label } from "@/src/presentation/components/ui/label";
import { processSpeechAction } from "@/src/interfaces/next/actions/speeches";
import type { ActionState } from "@/src/interfaces/next/action-state";
import type { SpeechView } from "@/src/interfaces/next/view-models";
import {
  ALLOWED_AUDIO_EXTENSIONS,
  isAllowedAudioContentType,
  isAllowedAudioExtension,
  isAudioContentTypeAllowedForExtension,
  MAX_AUDIO_INPUT_BYTES,
  type AllowedAudioExtension,
} from "@/src/application/policies/audio-input";
import { buildStagedAudioPathname } from "@/src/application/policies/staged-audio-path";

type SpeechActionState = ActionState<SpeechView | undefined>;
const INITIAL_STATE: SpeechActionState = { status: "idle" };
const MULTIPART_THRESHOLD_BYTES = 5 * 1024 * 1024;

// Audio validation result
type AudioValidation =
  | { readonly valid: true; readonly extension: AllowedAudioExtension }
  | { readonly valid: false; readonly message: string };

// Accept field for file input
const AUDIO_FILE_ACCEPT = ALLOWED_AUDIO_EXTENSIONS.map(
  (extension) => `.${extension}`,
).join(",");

export function SpeechUploadSection({ userId }: { readonly userId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  // User-facing errors
  const [clientError, setClientError] = useState<string | null>(null);
  // Contains the result of processing
  const [actionState, setActionState] =
    useState<SpeechActionState>(INITIAL_STATE);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, startProcessing] = useTransition();

  const isBusy = isUploading || isProcessing;
  const result =
    actionState.status === "success" ? (actionState.data ?? null) : null;
  const fileName = file?.name ?? "No file selected";

  async function submitAudio(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const selected = file;
    if (selected === null) {
      setClientError("Please select an audio file first.");
      return;
    }

    const validation = validateAudioFile(selected);
    if (!validation.valid) {
      setClientError(validation.message);
      return;
    }

    setClientError(null);
    setActionState(INITIAL_STATE);
    setUploadProgress(0);
    setIsUploading(true);

    try {
      // Blob upload
      const pathname = buildStagedAudioPathname(userId, validation.extension);
      const blob = await uploadPresigned(pathname, selected, {
        access: "private",
        contentType: selected.type,
        handleUploadUrl: "/api/uploads/audio",
        multipart: selected.size > MULTIPART_THRESHOLD_BYTES,
        onUploadProgress: ({ percentage }) => setUploadProgress(percentage),
      });

      setIsUploading(false);
      setUploadProgress(null);

      // Process audio after upload
      startProcessing(async () => {
        try {
          setActionState(
            await processSpeechAction({
              pathname: blob.pathname,
              etag: blob.etag,
            }),
          );
        } catch {
          setActionState({ status: "error", message: "Upload failed" });
        }
      });
    } catch {
      setActionState({ status: "error", message: "Upload failed" });
      setIsUploading(false);
      setUploadProgress(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload audio</CardTitle>
          <CardDescription>
            Send a short audio clip for transcription and grammar analysis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => void submitAudio(event)}
          >
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="audio-file">Audio clip</Label>
                <Input
                  id="audio-file"
                  name="file"
                  type="file"
                  accept={AUDIO_FILE_ACCEPT}
                  required
                  disabled={isBusy}
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setClientError(null);
                    setActionState(INITIAL_STATE);
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  Selected file: {fileName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Supported audio formats up to 25 MiB.
                </p>
              </div>
              <Button
                className="w-full md:w-auto"
                type="submit"
                disabled={isBusy || file === null}
              >
                {busyLabel(isUploading, isProcessing, uploadProgress)}
              </Button>
            </div>
            {clientError !== null || actionState.status === "error" ? (
              <p
                className="text-sm text-destructive"
                role="alert"
                aria-live="polite"
              >
                {clientError ??
                  (actionState.status === "error" ? actionState.message : "")}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest result</CardTitle>
          <CardDescription>
            Feedback and detected mistakes from your upload.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SpeechResultCard speech={result} />
        </CardContent>
      </Card>
    </div>
  );
}

function validateAudioFile(file: File): AudioValidation {
  if (file.size <= 0) {
    return { valid: false, message: "Audio must not be empty" };
  }
  if (file.size > MAX_AUDIO_INPUT_BYTES) {
    return { valid: false, message: "Audio must be no larger than 25 MiB" };
  }

  // Validate file extention and content type
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (!isAllowedAudioExtension(extension)) {
    return {
      valid: false,
      message: "This audio file format is not supported.",
    };
  }
  if (
    !isAllowedAudioContentType(file.type) ||
    !isAudioContentTypeAllowedForExtension(extension, file.type)
  ) {
    return {
      valid: false,
      message: "This audio file type is not supported.",
    };
  }
  return { valid: true, extension };
}

function busyLabel(
  isUploading: boolean,
  isProcessing: boolean,
  progress: number | null,
): string {
  if (isUploading) {
    return progress === null
      ? "Uploading..."
      : `Uploading ${Math.round(progress)}%...`;
  }
  if (isProcessing) return "Processing...";
  return "Upload and analyze";
}
