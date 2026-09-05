import type { SpeechView } from "@/src/interfaces/next/view-models";
import { mistakeCategoryLabel } from "@/src/presentation/mistake-categories";

interface SpeechResultCardProps {
  readonly speech: SpeechView | null;
}

export function SpeechResultCard({ speech }: SpeechResultCardProps) {
  if (speech === null) {
    return (
      <p className="text-sm text-muted-foreground">
        No speech has been processed yet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-md border bg-muted/30 p-4">
          <h3 className="text-sm font-medium">Transcript</h3>
          <p className="mt-2 whitespace-pre-wrap wrap-break-word text-sm text-muted-foreground">
            {speech.transcript}
          </p>
        </section>
        <section className="rounded-md border bg-muted/30 p-4">
          <h3 className="text-sm font-medium">Feedback</h3>
          <p className="mt-2 whitespace-pre-wrap wrap-break-word text-sm text-muted-foreground">
            {speech.analysis.feedback}
          </p>
        </section>
      </div>

      <section>
        <h3 className="text-sm font-medium">Detected mistakes</h3>
        {speech.analysis.mistakes.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No grammar mistakes detected.
          </p>
        ) : (
          <ul className="mt-3 grid items-start gap-3 text-sm text-muted-foreground md:grid-cols-2">
            {speech.analysis.mistakes.map((mistake, index) => (
              <li
                key={`${mistake.category}-${index}`}
                className="space-y-2 rounded-md border p-4"
              >
                <p className="font-medium text-foreground">
                  {mistakeCategoryLabel(mistake.category)}
                </p>
                <p className="wrap-break-word">
                  <span className="font-medium text-foreground">Original:</span>{" "}
                  {mistake.originalText}
                </p>
                <p className="wrap-break-word">
                  <span className="font-medium text-foreground">
                    Correction:
                  </span>{" "}
                  {mistake.correction}
                </p>
                <p className="wrap-break-word">
                  <span className="font-medium text-foreground">
                    Explanation:
                  </span>{" "}
                  {mistake.explanation}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
