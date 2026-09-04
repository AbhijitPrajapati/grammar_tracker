import { SpeechTable } from "@/src/presentation/components/speech/SpeechTable";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/presentation/components/ui/card";
import { listCurrentUserSpeeches } from "@/src/interfaces/next/queries/speeches";

export default async function SpeechesPage() {
  const speeches = await listCurrentUserSpeeches();

  return (
    <main className="px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div>
          <p className="text-sm font-medium text-primary">Speeches</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Manage saved speeches
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Speech history</CardTitle>
            <CardDescription>
              Review your latest saved transcripts and remove entries you no
              longer need.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <SpeechTable speeches={speeches} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
