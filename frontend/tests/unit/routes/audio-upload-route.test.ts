import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ALLOWED_AUDIO_CONTENT_TYPES,
  MAX_STAGED_AUDIO_BYTES,
  buildStagedAudioPathname,
} from "@/src/adapters/outbound/blob";
import { POST } from "@/app/api/uploads/audio/route";

const USER_ID = "4fcd2c4d-c90b-4202-8b1f-f59cf95cced6";
const PATHNAME = buildStagedAudioPathname(USER_ID, "webm");
const NOW = new Date("2026-09-02T18:00:00.000Z");

const doubles = vi.hoisted(() => ({
  issueSignedToken: vi.fn(),
  handleUploadPresigned: vi.fn(),
  getCurrentUser: vi.fn(),
  getServerEnvironment: vi.fn(),
  warn: vi.fn(),
  requestedPathname: "",
}));

vi.mock("@vercel/blob", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@vercel/blob")>()),
  issueSignedToken: doubles.issueSignedToken,
}));

vi.mock("@vercel/blob/client", () => ({
  handleUploadPresigned: doubles.handleUploadPresigned,
}));

vi.mock("@/src/adapters/outbound/config/env", () => ({
  getServerEnvironment: doubles.getServerEnvironment,
}));

vi.mock("@/src/adapters/outbound/observability/logger", () => ({
  getLogger: () => ({ warn: doubles.warn }),
}));

vi.mock("@/src/adapters/inbound/next/session", () => ({
  getCurrentUser: doubles.getCurrentUser,
}));

function request(body: unknown = { type: "blob.generate-presigned-url" }) {
  return new Request("https://grammar.test/api/uploads/audio", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  doubles.requestedPathname = PATHNAME;
  doubles.getServerEnvironment.mockReturnValue({
    blobStoreId: "store_test",
    blobWebhookPublicKey: "webhook-public-key",
  });
  doubles.getCurrentUser.mockResolvedValue({ id: USER_ID });
  doubles.issueSignedToken.mockResolvedValue({ token: "signed-token" });
  doubles.handleUploadPresigned.mockImplementation(
    async (options: {
      getSignedToken: (pathname: string) => Promise<unknown>;
    }) => {
      await options.getSignedToken(doubles.requestedPathname);
      return {
        type: "blob.generate-presigned-url",
        presignedUrlPayload: { presignedUrl: "https://blob.test/upload" },
      };
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("audio upload token route", () => {
  it("issues a short-lived, owner-scoped, put-only upload delegation", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(doubles.handleUploadPresigned).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { type: "blob.generate-presigned-url" },
        webhookPublicKey: "webhook-public-key",
        request: expect.any(Request),
        getSignedToken: expect.any(Function),
      }),
    );
    expect(doubles.issueSignedToken).toHaveBeenCalledWith({
      storeId: "store_test",
      pathname: PATHNAME,
      operations: ["put"],
      allowedContentTypes: [...ALLOWED_AUDIO_CONTENT_TYPES],
      maximumSizeInBytes: MAX_STAGED_AUDIO_BYTES,
      validUntil: NOW.getTime() + 10 * 60 * 1_000,
    });

    const signedTokenResult =
      await doubles.handleUploadPresigned.mock.calls[0]?.[0].getSignedToken(
        PATHNAME,
      );
    expect(signedTokenResult).toMatchObject({
      urlOptions: {
        validUntil: NOW.getTime() + 10 * 60 * 1_000,
        allowedContentTypes: [...ALLOWED_AUDIO_CONTENT_TYPES],
        maximumSizeInBytes: MAX_STAGED_AUDIO_BYTES,
        allowOverwrite: true,
        addRandomSuffix: false,
        cacheControlMaxAge: 60,
      },
    });
  });

  it("returns 401 without minting a token for an unauthenticated browser", async () => {
    doubles.getCurrentUser.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication required",
    });
    expect(doubles.issueSignedToken).not.toHaveBeenCalled();
  });

  it("rejects cross-user and arbitrary-path token requests", async () => {
    doubles.requestedPathname = buildStagedAudioPathname(
      "87509066-5ed7-4b44-ab47-d49d75b94f20",
      "webm",
    );

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(doubles.issueSignedToken).not.toHaveBeenCalled();
    expect(doubles.warn).toHaveBeenCalledOnce();
  });

  it("maps malformed route JSON to a generic request error", async () => {
    const response = await POST(
      new Request("https://grammar.test/api/uploads/audio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid upload request",
    });
    expect(doubles.handleUploadPresigned).not.toHaveBeenCalled();
  });
});
