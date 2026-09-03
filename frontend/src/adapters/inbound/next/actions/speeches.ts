"use server";

import { revalidatePath } from "next/cache";

import type { StagedAudioReference } from "@/src/core/application/ports/services";
import { getApplicationContainer } from "@/src/bootstrap/container";
import { getLogger } from "@/src/adapters/outbound/observability/logger";
import { actionError } from "../action-error";
import type { ActionState } from "../action-state";
import { requireCurrentUser } from "../session";
import {
  fieldErrors,
  speechIdSchema,
  stagedAudioReferenceSchema,
} from "../validation";
import { toSpeechView, type SpeechView } from "../view-models";

export async function processStagedAudioAction(
  input: StagedAudioReference,
): Promise<ActionState<SpeechView | undefined>> {
  const parsed = stagedAudioReferenceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "The staged audio reference is invalid.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const user = await requireCurrentUser();
  const container = getApplicationContainer();
  try {
    const audio = await container.stagedAudioStore.resolve(user.id, parsed.data);
    const speech = await container.processSpeech.execute(user.id, audio);
    revalidateSpeechViews();
    return { status: "success", data: toSpeechView(speech) };
  } catch (error) {
    return actionError(error, "process_staged_audio", "Upload failed");
  } finally {
    try {
      await container.stagedAudioStore.delete(user.id, parsed.data);
    } catch (cleanupError) {
      getLogger().error(
        {
          operation: "delete_staged_audio",
          errorType:
            cleanupError instanceof Error ? cleanupError.name : "UnknownError",
        },
        "Staged audio cleanup failed",
      );
    }
  }
}

export async function deleteSpeechAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void previousState;
  const parsed = speechIdSchema.safeParse(formData.get("speechId"));
  if (!parsed.success) {
    return { status: "error", message: "Speech not found" };
  }

  const user = await requireCurrentUser();
  try {
    await getApplicationContainer().deleteSpeech.execute(parsed.data, user.id);
    revalidateSpeechViews();
    return { status: "success", data: undefined };
  } catch (error) {
    return actionError(error, "delete_speech", "Unable to delete the speech.");
  }
}

function revalidateSpeechViews(): void {
  revalidatePath("/");
  revalidatePath("/speeches");
  revalidatePath("/analytics");
}
