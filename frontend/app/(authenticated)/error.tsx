"use client";

import { Button } from "@/components/ui/button";

export default function AuthenticatedError({
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}) {
  return (
    <main className="px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Unable to load this page</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong while loading your data. Please try again.
        </p>
        <Button className="mt-4" type="button" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
