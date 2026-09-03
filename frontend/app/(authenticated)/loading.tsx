export default function AuthenticatedLoading() {
  return (
    <main className="px-4 py-10" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-6xl rounded-xl border bg-card p-8 text-sm text-muted-foreground shadow-sm">
        Loading…
      </div>
    </main>
  );
}
