import "server-only";

import { getApplicationContainer } from "@/src/bootstrap/container";
import { requireCurrentUser } from "../session";
import { toSpeechView, type SpeechView } from "../view-models";

export async function listCurrentUserSpeeches(): Promise<
  readonly SpeechView[]
> {
  const user = await requireCurrentUser();
  const speeches = await getApplicationContainer().listSpeeches.execute(
    user.id,
  );
  return speeches.map(toSpeechView);
}
