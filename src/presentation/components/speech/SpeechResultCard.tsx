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
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Transcript</p>
        <p className="text-sm text-muted-foreground">{speech.transcript}</p>
      </div>
      <div>
        <p className="text-sm font-medium">Feedback</p>
        <p className="text-sm text-muted-foreground">
          {speech.analysis.feedback}
        </p>
      </div>
      <div>
        <p className="text-sm font-medium">Detected mistakes</p>
        {speech.analysis.mistakes.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No grammar mistakes detected.
          </p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {speech.analysis.mistakes.map((mistake, index) => (
              <li
                key={`${mistake.category}-${index}`}
                className="rounded-md border p-3"
              >
                <p className="font-medium text-foreground">
                  {mistakeCategoryLabel(mistake.category)}
                </p>
                <p>Original: {mistake.originalText}</p>
                <p>Correction: {mistake.correction}</p>
                <p>Explanation: {mistake.explanation}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
