"use server";

import { revalidatePath } from "next/cache";

import { getApplicationContainer } from "@/src/bootstrap/container";
import type { StagedAudioReference } from "@/src/application/contracts/staged-audio";
import { actionError } from "../action-error";
import type { ActionState } from "../action-state";
import { requireCurrentUser } from "../session";
import {
  fieldErrors,
  speechIdSchema,
  stagedAudioReferenceSchema,
} from "../validation";
import { toSpeechView, type SpeechView } from "../view-models";

export async function processSpeechAction(
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
  try {
    const speech = await getApplicationContainer().processSpeech.execute(
      user.id,
      parsed.data,
    );
    revalidateSpeechViews();
    return { status: "success", data: toSpeechView(speech) };
  } catch (error) {
    return actionError(error, "process_staged_audio", "Upload failed");
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
  revalidatePath("/speeches");
  revalidatePath("/analytics");
}
