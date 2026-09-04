"use client";

import { useActionState, type FormEvent } from "react";

import { Button } from "@/src/presentation/components/ui/button";
import { deleteAccountAction } from "@/src/interfaces/next/actions/account";
import type { ActionState } from "@/src/interfaces/next/action-state";

const INITIAL_STATE: ActionState = { status: "idle" };

export function DeleteAccountButton() {
  const [state, formAction, isPending] = useActionState(
    deleteAccountAction,
    INITIAL_STATE,
  );

  function confirmDeletion(event: FormEvent<HTMLFormElement>): void {
    if (!window.confirm("Delete your account and all saved speeches?")) {
      event.preventDefault();
    }
  }

  return (
    <form className="space-y-3" action={formAction} onSubmit={confirmDeletion}>
      <Button variant="destructive" type="submit" disabled={isPending}>
        {isPending ? "Deleting account..." : "Delete account"}
      </Button>
      {state.status === "error" ? (
        <p className="text-sm text-destructive" role="alert" aria-live="polite">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
