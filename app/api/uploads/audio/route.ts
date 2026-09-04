import { issueSignedToken } from "@vercel/blob";
import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";
import { NextResponse } from "next/server";

import {
  ALLOWED_AUDIO_CONTENT_TYPES,
  MAX_AUDIO_INPUT_BYTES,
} from "@/src/application/policies/audio-input";
import { getServerEnvironment } from "@/src/infrastructure/config/env";
import { getLogger } from "@/src/infrastructure/observability/logger";
import { getCurrentUser } from "@/src/interfaces/next/session";
import { validateStagedAudioPathname } from "@/src/application/policies/staged-audio-path";

export const runtime = "nodejs";
export const maxDuration = 30;

const SIGNED_UPLOAD_LIFETIME_MS = 10 * 60 * 1_000;

class UploadAuthenticationError extends Error {}

export async function POST(request: Request): Promise<Response> {
  const environment = getServerEnvironment();

  try {
    const body = (await request.json()) as HandleUploadPresignedBody;
    const result = await handleUploadPresigned({
      request,
      body,
      webhookPublicKey: environment.blobWebhookPublicKey,
      getSignedToken: async (pathname) => {
        const user = await getCurrentUser();
        if (user === null) throw new UploadAuthenticationError();

        validateStagedAudioPathname(user.id, pathname);
        const validUntil = Date.now() + SIGNED_UPLOAD_LIFETIME_MS;
        const token = await issueSignedToken({
          storeId: environment.blobStoreId,
          pathname,
          operations: ["put"],
          allowedContentTypes: [...ALLOWED_AUDIO_CONTENT_TYPES],
          maximumSizeInBytes: MAX_AUDIO_INPUT_BYTES,
          validUntil,
        });

        return {
          token,
          urlOptions: {
            validUntil,
            allowedContentTypes: [...ALLOWED_AUDIO_CONTENT_TYPES],
            maximumSizeInBytes: MAX_AUDIO_INPUT_BYTES,
            // Each user has one etag-protected staging slot per supported format
            // This bounds abandoned storage
            allowOverwrite: true,
            addRandomSuffix: false,
          },
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UploadAuthenticationError) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    getLogger().warn(
      {
        operation: "issue_audio_upload",
        errorType: error instanceof Error ? error.name : "UnknownError",
      },
      "Audio upload request rejected",
    );
    return NextResponse.json(
      { error: "Invalid upload request" },
      { status: 400 },
    );
  }
}
