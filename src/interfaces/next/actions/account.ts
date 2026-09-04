"use server";

import { redirect } from "next/navigation";

import { NewPassword } from "@/src/domain/user";
import { getApplicationContainer } from "@/src/bootstrap/container";
import { actionError } from "../action-error";
import type { ActionState } from "../action-state";
import { clearSessionCookie, requireCurrentUser } from "../session";
import { fieldErrors, passwordChangeSchema } from "../validation";

export async function changePasswordAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Verify valid password change inputs
  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const user = await requireCurrentUser();
  try {
    await getApplicationContainer().changePassword.execute(
      user.id,
      parsed.data.currentPassword,
      new NewPassword(parsed.data.newPassword),
    );
    return { status: "success", data: undefined };
  } catch (error) {
    return actionError(
      error,
      "change_password",
      "Unable to change your password.",
    );
  }
}

export async function deleteAccountAction(
  previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  void previousState;
  void formData;
  const user = await requireCurrentUser();
  try {
    await getApplicationContainer().deleteUser.execute(user.id);
  } catch (error) {
    return actionError(
      error,
      "delete_account",
      "Unable to delete your account.",
    );
  }

  await clearSessionCookie();
  redirect("/auth");
}
