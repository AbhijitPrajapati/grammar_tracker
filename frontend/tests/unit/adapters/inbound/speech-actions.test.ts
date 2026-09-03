import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AnalysisQuotaReached,
  InvalidAudio,
} from "@/src/core/application/errors";
import { Analysis } from "@/src/core/domain/analysis";
import { Speech } from "@/src/core/domain/speech";
import { processStagedAudioAction } from "@/src/adapters/inbound/next/actions/speeches";

const USER_ID = "4fcd2c4d-c90b-4202-8b1f-f59cf95cced6";
const REFERENCE = {
  pathname: `speech-staging/${USER_ID}/audio.webm`,
  etag: "opaque-etag",
} as const;

const doubles = vi.hoisted(() => ({
  resolve: vi.fn(),
  delete: vi.fn(),
  process: vi.fn(),
  requireCurrentUser: vi.fn(),
  revalidatePath: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: doubles.revalidatePath,
}));

vi.mock("@/src/bootstrap/container", () => ({
  getApplicationContainer: () => ({
    stagedAudioStore: {
      resolve: doubles.resolve,
      delete: doubles.delete,
    },
    processSpeech: { execute: doubles.process },
  }),
}));

vi.mock("@/src/adapters/inbound/next/session", () => ({
  requireCurrentUser: doubles.requireCurrentUser,
}));

vi.mock("@/src/adapters/outbound/observability/logger", () => ({
  getLogger: () => ({ error: doubles.logError }),
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
  doubles.resolve.mockResolvedValue({ filename: "audio.webm" });
  doubles.process.mockResolvedValue(speech);
  doubles.delete.mockResolvedValue(undefined);
});

describe("staged speech processing action", () => {
  it("processes as the authenticated owner and always removes the staging blob", async () => {
    const result = await processStagedAudioAction(REFERENCE);

    expect(result).toMatchObject({
      status: "success",
      data: {
        id: speech.id,
        transcript: "I spoke clearly.",
        createdAt: "2026-09-02T18:00:00.000Z",
      },
    });
    expect(doubles.resolve).toHaveBeenCalledWith(USER_ID, REFERENCE);
    expect(doubles.process).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ filename: "audio.webm" }),
    );
    expect(doubles.delete).toHaveBeenCalledWith(USER_ID, REFERENCE);
    expect(doubles.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/",
      "/speeches",
      "/analytics",
    ]);
  });

  it("does not authenticate or touch storage for a malformed reference", async () => {
    const result = await processStagedAudioAction({
      pathname: REFERENCE.pathname,
      etag: "",
    });

    expect(result).toMatchObject({
      status: "error",
      message: "The staged audio reference is invalid.",
    });
    expect(doubles.requireCurrentUser).not.toHaveBeenCalled();
    expect(doubles.resolve).not.toHaveBeenCalled();
    expect(doubles.delete).not.toHaveBeenCalled();
  });

  it("conditionally cleans up even when resolution or processing fails", async () => {
    doubles.resolve.mockRejectedValueOnce(
      new InvalidAudio("Staged audio ETag changed"),
    );
    const invalidAudio = await processStagedAudioAction(REFERENCE);
    expect(invalidAudio).toEqual({
      status: "error",
      message: "Staged audio ETag changed",
    });
    expect(doubles.delete).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    doubles.requireCurrentUser.mockResolvedValue({ id: USER_ID });
    doubles.resolve.mockResolvedValue({ filename: "audio.webm" });
    doubles.process.mockRejectedValue(new AnalysisQuotaReached());
    doubles.delete.mockResolvedValue(undefined);

    const quota = await processStagedAudioAction(REFERENCE);
    expect(quota).toEqual({ status: "error", message: "Analysis quota reached" });
    expect(doubles.delete).toHaveBeenCalledWith(USER_ID, REFERENCE);
  });

  it("does not turn successful processing into failure when cleanup races", async () => {
    doubles.delete.mockRejectedValue(new Error("precondition failed"));

    const result = await processStagedAudioAction(REFERENCE);

    expect(result.status).toBe("success");
    expect(doubles.logError).toHaveBeenCalledWith(
      {
        operation: "delete_staged_audio",
        errorType: "Error",
      },
      "Staged audio cleanup failed",
    );
  });
});
