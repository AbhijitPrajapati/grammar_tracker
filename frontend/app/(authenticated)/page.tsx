import { SpeechUploadSection } from "@/components/speech/SpeechUploadSection";
import { requireCurrentUser } from "@/src/adapters/inbound/next/session";

export const maxDuration = 300;

export default async function HomePage() {
  const user = await requireCurrentUser();

  return (
    <main className="px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div>
          <p className="text-sm font-medium text-primary">Speech analysis</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Upload a speech sample
          </h1>
        </div>

        <SpeechUploadSection userId={user.id} />
      </div>
    </main>
  );
}
