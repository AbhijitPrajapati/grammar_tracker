"use client";

import { useActionState, useState } from "react";

import { Button } from "@/src/presentation/components/ui/button";
import { Input } from "@/src/presentation/components/ui/input";
import { Label } from "@/src/presentation/components/ui/label";
import { authenticateAction } from "@/src/interfaces/next/actions/auth";
import type { ActionState } from "@/src/interfaces/next/action-state";

type AuthMode = "login" | "register";

const INITIAL_STATE: ActionState = { status: "idle" };

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <AuthModeForm
      key={mode}
      mode={mode}
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onToggleMode={() =>
        setMode((current) => (current === "login" ? "register" : "login"))
      }
    />
  );
}

function AuthModeForm({
  mode,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onToggleMode,
}: {
  mode: AuthMode;
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onToggleMode: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    authenticateAction,
    INITIAL_STATE,
  );

  return (
    <form className="space-y-4" action={formAction}>
      <input type="hidden" name="mode" value={mode} />
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={320}
          value={email}
          onChange={(event) => onEmailChange(event.currentTarget.value)}
          aria-invalid={Boolean(
            state.status === "error" && state.fieldErrors?.email,
          )}
          aria-describedby="email-errors"
          required
        />
        <FieldErrors id="email-errors" errors={fieldErrors(state, "email")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={8}
          maxLength={128}
          value={password}
          onChange={(event) => onPasswordChange(event.currentTarget.value)}
          aria-invalid={Boolean(
            state.status === "error" && state.fieldErrors?.password,
          )}
          aria-describedby="password-errors"
          required
        />
        <FieldErrors
          id="password-errors"
          errors={fieldErrors(state, "password")}
        />
      </div>
      {state.status === "error" ? (
        <p className="text-sm text-destructive" role="alert" aria-live="polite">
          {state.message}
        </p>
      ) : null}
      <Button className="w-full" type="submit" disabled={isPending}>
        {isPending
          ? "Please wait..."
          : mode === "login"
            ? "Sign in"
            : "Create account"}
      </Button>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <button
          type="button"
          className="font-medium text-primary"
          onClick={onToggleMode}
        >
          {mode === "login" ? "Need an account?" : "Already have an account?"}
        </button>
      </div>
    </form>
  );
}

function fieldErrors(state: ActionState, field: string): readonly string[] {
  return state.status === "error" ? (state.fieldErrors?.[field] ?? []) : [];
}

function FieldErrors({
  id,
  errors,
}: {
  id: string;
  errors: readonly string[];
}) {
  if (errors.length === 0) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {errors.join(" ")}
    </p>
  );
}
