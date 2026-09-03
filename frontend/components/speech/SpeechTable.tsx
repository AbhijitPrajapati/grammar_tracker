import { DeleteSpeechButton } from "@/components/speech/DeleteSpeechButton";
import { LocalDateTime } from "@/components/speech/LocalDateTime";
import type { SpeechView } from "@/src/adapters/inbound/next/view-models";

interface SpeechTableProps {
  readonly speeches: readonly SpeechView[];
}

export function SpeechTable({ speeches }: SpeechTableProps) {
  if (speeches.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No speeches saved yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-3xl text-left text-sm">
        <thead className="border-b text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Created</th>
            <th className="px-4 py-3 font-medium">Transcript</th>
            <th className="px-4 py-3 text-center font-medium">Mistakes</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {speeches.map((speech) => (
            <tr key={speech.id} className="align-top">
              <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">
                <LocalDateTime value={speech.createdAt} />
              </td>
              <td className="max-w-xl px-4 py-4">
                <p className="line-clamp-2">{speech.transcript}</p>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {speech.analysis.feedback}
                </p>
              </td>
              <td className="px-4 py-4 text-center tabular-nums">
                {speech.analysis.mistakes.length}
              </td>
              <td className="px-4 py-4 text-right">
                <DeleteSpeechButton speechId={speech.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
