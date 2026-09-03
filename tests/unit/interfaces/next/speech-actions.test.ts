import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AnalysisQuotaReached,
  InvalidAudio,
} from "@/src/application/errors";
import { Analysis } from "@/src/domain/analysis";
import { Speech } from "@/src/domain/speech";
import { processSpeechAction } from "@/src/interfaces/next/actions/speeches";

const USER_ID = "4fcd2c4d-c90b-4202-8b1f-f59cf95cced6";
const REFERENCE = {
  pathname: `speech-staging/${USER_ID}/audio.webm`,
  etag: "opaque-etag",
} as const;

const doubles = vi.hoisted(() => ({
  processSpeech: vi.fn(),
  requireCurrentUser: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: doubles.revalidatePath,
}));

vi.mock("@/src/bootstrap/container", () => ({
  getApplicationContainer: () => ({
    processSpeech: { execute: doubles.processSpeech },
  }),
}));

vi.mock("@/src/interfaces/next/session", () => ({
  requireCurrentUser: doubles.requireCurrentUser,
}));

const speech = new Speech({
  id: "b8742aa2-bc1a-4ad4-8746-9d6b905431f0",
  userId: USER_ID,
  transcript: "I spoke clearly.",
  createdAt: new Date("2026-09-02T18:00:00.000Z"),
  analysis: new Analysis({
    mistakes: [],
    frequencies: [
      { category: "verb_tense", occurrences: 0, opportunities: 1 },
    ],
    feedback: "Well done.",
  }),
});

beforeEach(() => {
  vi.clearAllMocks();
  doubles.requireCurrentUser.mockResolvedValue({ id: USER_ID });
  doubles.processSpeech.mockResolvedValue(speech);
});

describe("staged speech processing action", () => {
  it("passes the authenticated owner and staged reference to the application", async () => {
    const result = await processSpeechAction(REFERENCE);

    expect(result).toMatchObject({
      status: "success",
      data: {
        id: speech.id,
        transcript: "I spoke clearly.",
        createdAt: "2026-09-02T18:00:00.000Z",
      },
    });
    expect(doubles.processSpeech).toHaveBeenCalledWith(USER_ID, REFERENCE);
    expect(doubles.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/",
      "/speeches",
      "/analytics",
    ]);
  });

  it("does not authenticate or touch storage for a malformed reference", async () => {
    const result = await processSpeechAction({
      pathname: REFERENCE.pathname,
      etag: "",
    });

    expect(result).toMatchObject({
      status: "error",
      message: "The staged audio reference is invalid.",
    });
    expect(doubles.requireCurrentUser).not.toHaveBeenCalled();
    expect(doubles.processSpeech).not.toHaveBeenCalled();
  });

  it("maps expected application failures", async () => {
    doubles.processSpeech.mockRejectedValueOnce(
      new InvalidAudio("Staged audio ETag changed"),
    );
    const invalidAudio = await processSpeechAction(REFERENCE);
    expect(invalidAudio).toEqual({
      status: "error",
      message: "Staged audio ETag changed",
    });
    doubles.processSpeech.mockRejectedValueOnce(new AnalysisQuotaReached());

    const quota = await processSpeechAction(REFERENCE);
    expect(quota).toEqual({ status: "error", message: "Analysis quota reached" });
  });
});
