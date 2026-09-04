"use client";

import { useActionState, useState } from "react";

import { Button } from "@/src/presentation/components/ui/button";
import { Input } from "@/src/presentation/components/ui/input";
import { Label } from "@/src/presentation/components/ui/label";
import { changePasswordAction } from "@/src/interfaces/next/actions/account";
import type { ActionState } from "@/src/interfaces/next/action-state";

const INITIAL_STATE: ActionState = { status: "idle" };
const EMPTY_PASSWORDS = {
  currentPassword: "",
  newPassword: "",
  confirmation: "",
};

type PasswordFieldName = keyof typeof EMPTY_PASSWORDS;

export function PasswordChangeForm() {
  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);

  async function submitPasswordChange(
    previousState: ActionState,
    formData: FormData,
  ): Promise<ActionState> {
    const nextState = await changePasswordAction(previousState, formData);
    if (nextState.status === "success") setPasswords(EMPTY_PASSWORDS);
    return nextState;
  }

  const [state, formAction, isPending] = useActionState(
    submitPasswordChange,
    INITIAL_STATE,
  );

  function setPassword(name: PasswordFieldName, value: string): void {
    setPasswords((current) => ({ ...current, [name]: value }));
  }

  return (
    <form className="space-y-4" action={formAction}>
      <PasswordField
        id="current-password"
        name="currentPassword"
        label="Current password"
        autoComplete="current-password"
        value={passwords.currentPassword}
        onChange={(value) => setPassword("currentPassword", value)}
        errors={fieldErrors(state, "currentPassword")}
      />
      <PasswordField
        id="new-password"
        name="newPassword"
        label="New password"
        autoComplete="new-password"
        value={passwords.newPassword}
        onChange={(value) => setPassword("newPassword", value)}
        errors={fieldErrors(state, "newPassword")}
      />
      <PasswordField
        id="confirm-password"
        name="confirmation"
        label="Confirm new password"
        autoComplete="new-password"
        value={passwords.confirmation}
        onChange={(value) => setPassword("confirmation", value)}
        errors={fieldErrors(state, "confirmation")}
      />
      {state.status === "error" && !hasFieldErrors(state) ? (
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
  value,
  onChange,
  errors,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
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
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
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

function hasFieldErrors(state: ActionState): boolean {
  return (
    state.status === "error" &&
    Object.values(state.fieldErrors ?? {}).some((errors) => errors.length > 0)
  );
}
