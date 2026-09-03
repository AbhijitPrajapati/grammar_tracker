"use client";

import { useActionState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { deleteSpeechAction } from "@/src/adapters/inbound/next/actions/speeches";
import type { ActionState } from "@/src/adapters/inbound/next/action-state";

const INITIAL_STATE: ActionState = { status: "idle" };

export function DeleteSpeechButton({
  speechId,
}: {
  readonly speechId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    deleteSpeechAction,
    INITIAL_STATE,
  );

  function confirmDeletion(event: FormEvent<HTMLFormElement>): void {
    if (!window.confirm("Delete this saved speech?")) event.preventDefault();
  }

  return (
    <form action={formAction} onSubmit={confirmDeletion}>
      <input type="hidden" name="speechId" value={speechId} />
      <Button
        variant="destructive"
        size="sm"
        type="submit"
        disabled={isPending}
      >
        {isPending ? "Deleting..." : "Delete"}
      </Button>
      {state.status === "error" ? (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
