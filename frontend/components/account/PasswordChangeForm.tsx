"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction } from "@/src/adapters/inbound/next/actions/account";
import type { ActionState } from "@/src/adapters/inbound/next/action-state";

const INITIAL_STATE: ActionState = { status: "idle" };

export function PasswordChangeForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    changePasswordAction,
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} className="space-y-4" action={formAction}>
      <PasswordField
        id="current-password"
        name="currentPassword"
        label="Current password"
        autoComplete="current-password"
        errors={fieldErrors(state, "currentPassword")}
      />
      <PasswordField
        id="new-password"
        name="newPassword"
        label="New password"
        autoComplete="new-password"
        errors={fieldErrors(state, "newPassword")}
      />
      <PasswordField
        id="confirm-password"
        name="confirmation"
        label="Confirm new password"
        autoComplete="new-password"
        errors={fieldErrors(state, "confirmation")}
      />
      {state.status === "error" ? (
        <p className="text-sm text-destructive" role="alert" aria-live="polite">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className="text-sm text-emerald-700" role="status">
          Password changed.
        </p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Changing password..." : "Change password"}
      </Button>
    </form>
  );
}

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  errors,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  errors: readonly string[];
}) {
  const errorId = `${id}-errors`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type="password"
        autoComplete={autoComplete}
        minLength={8}
        maxLength={128}
        required
        aria-invalid={errors.length > 0}
        aria-describedby={errorId}
      />
      {errors.length > 0 ? (
        <p id={errorId} className="text-sm text-destructive">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

function fieldErrors(state: ActionState, field: string): readonly string[] {
  return state.status === "error" ? (state.fieldErrors?.[field] ?? []) : [];
}
