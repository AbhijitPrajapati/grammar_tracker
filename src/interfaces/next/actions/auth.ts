"use server";

import { redirect } from "next/navigation";

import { EmailAddress, NewPassword } from "@/src/domain/user";
import { getApplicationContainer } from "@/src/bootstrap/container";
import { actionError } from "../action-error";
import type { ActionState } from "../action-state";
import { clearSessionCookie, setSessionCookie } from "../session";
import { authFormSchema, fieldErrors } from "../validation";

export async function authenticateAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = authFormSchema.safeParse({
    mode: formData.get("mode"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please correct the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const container = getApplicationContainer();
  let token: string;
  try {
    if (parsed.data.mode === "register") {
      const registered = await container.registerAndStartSession.execute(
        new EmailAddress(parsed.data.email),
        // Construct NewPassword if registering
        new NewPassword(parsed.data.password),
      );
      token = registered.sessionToken;
    } else {
      const session = await container.login.execute(
        new EmailAddress(parsed.data.email),
        parsed.data.password,
      );
      token = session.sessionToken;
    }
  } catch (error) {
    return actionError(
      error,
      parsed.data.mode,
      "Unable to authenticate. Please try again.",
    );
  }

  await setSessionCookie(token);
  redirect("/");
}

export async function logoutAction(): Promise<never> {
  await clearSessionCookie();
  redirect("/auth");
}
