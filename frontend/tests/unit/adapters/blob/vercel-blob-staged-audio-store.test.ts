import { BlobNotFoundError } from "@vercel/blob";
import { describe, expect, it, vi } from "vitest";

import {
  MAX_STAGED_AUDIO_BYTES,
  VercelBlobStagedAudioStore,
  buildStagedAudioPathname,
  type PrivateBlobClient,
  type PrivateBlobGetResult,
  type StagedAudioBlobMetadata,
} from "@/src/adapters/outbound/blob";
import { InvalidAudio } from "@/src/core/application/errors";

const USER_ID = "4fcd2c4d-c90b-4202-8b1f-f59cf95cced6";
const OTHER_USER_ID = "87509066-5ed7-4b44-ab47-d49d75b94f20";
const STORE_ID = "store_test";
const PATHNAME = buildStagedAudioPathname(USER_ID, "webm");
const ETAG = '"opaque-etag"';

function streamWith(value: number): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(Uint8Array.of(value));
      controller.close();
    },
  });
}

function metadata(
  overrides: Partial<StagedAudioBlobMetadata> = {},
): StagedAudioBlobMetadata {
  return {
    pathname: PATHNAME,
    etag: ETAG,
    size: 1_024,
    contentType: "audio/webm",
    ...overrides,
  };
}

function privateBlobClient(options: {
  readonly head?: () => Promise<StagedAudioBlobMetadata>;
  readonly get?: () => Promise<PrivateBlobGetResult | null>;
} = {}) {
  const head = vi.fn<PrivateBlobClient["head"]>(
    options.head ?? (async () => metadata()),
  );
  const get = vi.fn<PrivateBlobClient["get"]>(
    options.get ??
      (async () => ({
        statusCode: 200,
        stream: streamWith(1),
        blob: metadata(),
      })),
  );
  const del = vi.fn<PrivateBlobClient["del"]>(async () => undefined);

  return { client: { head, get, del }, head, get, del };
}

describe("VercelBlobStagedAudioStore", () => {
  it("resolves validated head metadata without eagerly downloading audio", async () => {
    const fake = privateBlobClient();
    const store = new VercelBlobStagedAudioStore(STORE_ID, fake.client);

    const audio = await store.resolve(USER_ID, {
      pathname: PATHNAME,
      etag: ETAG,
    });

    expect(audio).toMatchObject({
      filename: "audio.webm",
      mediaType: "audio/webm",
      sizeBytes: 1_024,
    });
    expect(fake.head).toHaveBeenCalledWith(PATHNAME, { storeId: STORE_ID });
    expect(fake.get).not.toHaveBeenCalled();
  });

  it("gets a fresh private uncached stream and revalidates it on every retry", async () => {
    const firstStream = streamWith(1);
    const secondStream = streamWith(2);
    const fake = privateBlobClient();
    fake.get
      .mockResolvedValueOnce({
        statusCode: 200,
        stream: firstStream,
        blob: metadata(),
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        stream: secondStream,
        blob: metadata(),
      });
    const store = new VercelBlobStagedAudioStore(STORE_ID, fake.client);
    const audio = await store.resolve(USER_ID, {
      pathname: PATHNAME,
      etag: ETAG,
    });

    await expect(audio.openStream()).resolves.toBe(firstStream);
    await expect(audio.openStream()).resolves.toBe(secondStream);
    expect(fake.get).toHaveBeenCalledTimes(2);
    expect(fake.get).toHaveBeenNthCalledWith(1, PATHNAME, {
      access: "private",
      useCache: false,
      storeId: STORE_ID,
    });
    expect(fake.get).toHaveBeenNthCalledWith(2, PATHNAME, {
      access: "private",
      useCache: false,
      storeId: STORE_ID,
    });
  });

  it.each([
    ["pathname", { pathname: `${PATHNAME}-changed` }],
    ["ETag", { etag: "different-etag" }],
    ["empty size", { size: 0 }],
    ["oversized content", { size: MAX_STAGED_AUDIO_BYTES + 1 }],
    ["non-audio MIME", { contentType: "video/webm" }],
    ["extension/MIME mismatch", { contentType: "audio/mpeg" }],
  ])("rejects invalid head %s metadata", async (_case, override) => {
    const fake = privateBlobClient({
      head: async () => metadata(override),
    });
    const store = new VercelBlobStagedAudioStore(STORE_ID, fake.client);

    await expect(
      store.resolve(USER_ID, { pathname: PATHNAME, etag: ETAG }),
    ).rejects.toBeInstanceOf(InvalidAudio);
    expect(fake.get).not.toHaveBeenCalled();
  });

  it("maps a missing blob during head validation to invalid audio", async () => {
    const fake = privateBlobClient({
      head: async () => {
        throw new BlobNotFoundError();
      },
    });
    const store = new VercelBlobStagedAudioStore(STORE_ID, fake.client);

    await expect(
      store.resolve(USER_ID, { pathname: PATHNAME, etag: ETAG }),
    ).rejects.toMatchObject({ code: "invalid_audio" });
  });

  it.each([
    ["missing result", null],
    [
      "unexpected status",
      { statusCode: 304, stream: null, blob: metadata() },
    ],
    [
      "changed pathname",
      {
        statusCode: 200,
        stream: streamWith(1),
        blob: metadata({ pathname: `${PATHNAME}-changed` }),
      },
    ],
    [
      "changed ETag",
      {
        statusCode: 200,
        stream: streamWith(1),
        blob: metadata({ etag: "changed" }),
      },
    ],
    [
      "changed size",
      {
        statusCode: 200,
        stream: streamWith(1),
        blob: metadata({ size: 2_048 }),
      },
    ],
    [
      "changed MIME type",
      {
        statusCode: 200,
        stream: streamWith(1),
        blob: metadata({ contentType: "audio/mpeg" }),
      },
    ],
  ] satisfies readonly [string, PrivateBlobGetResult | null][])(
    "rejects a fresh get with %s",
    async (_case, result) => {
      const fake = privateBlobClient({ get: async () => result });
      const store = new VercelBlobStagedAudioStore(STORE_ID, fake.client);
      const audio = await store.resolve(USER_ID, {
        pathname: PATHNAME,
        etag: ETAG,
      });

      await expect(audio.openStream()).rejects.toBeInstanceOf(InvalidAudio);
    },
  );

  it("conditionally deletes only the owned pathname", async () => {
    const fake = privateBlobClient();
    const store = new VercelBlobStagedAudioStore(STORE_ID, fake.client);

    await store.delete(USER_ID, { pathname: PATHNAME, etag: ETAG });

    expect(fake.del).toHaveBeenCalledOnce();
    expect(fake.del).toHaveBeenCalledWith(PATHNAME, {
      ifMatch: ETAG,
      storeId: STORE_ID,
    });
  });

  it("rejects another user's pathname before any Blob operation", async () => {
    const fake = privateBlobClient();
    const store = new VercelBlobStagedAudioStore(STORE_ID, fake.client);

    await expect(
      store.resolve(OTHER_USER_ID, { pathname: PATHNAME, etag: ETAG }),
    ).rejects.toBeInstanceOf(InvalidAudio);
    await expect(
      store.delete(OTHER_USER_ID, { pathname: PATHNAME, etag: ETAG }),
    ).rejects.toBeInstanceOf(InvalidAudio);
    expect(fake.head).not.toHaveBeenCalled();
    expect(fake.get).not.toHaveBeenCalled();
    expect(fake.del).not.toHaveBeenCalled();
  });

  it("rejects URL references and malformed ETags before any Blob operation", async () => {
    const fake = privateBlobClient();
    const store = new VercelBlobStagedAudioStore(STORE_ID, fake.client);

    await expect(
      store.resolve(USER_ID, {
        pathname: `https://example.test/${PATHNAME}`,
        etag: ETAG,
      }),
    ).rejects.toBeInstanceOf(InvalidAudio);
    await expect(
      store.delete(USER_ID, { pathname: PATHNAME, etag: "" }),
    ).rejects.toBeInstanceOf(InvalidAudio);
    expect(fake.head).not.toHaveBeenCalled();
    expect(fake.del).not.toHaveBeenCalled();
  });

  it("requires an explicit nonblank OIDC-connected store ID", () => {
    const fake = privateBlobClient();
    expect(() => new VercelBlobStagedAudioStore("", fake.client)).toThrow(
      TypeError,
    );
    expect(() => new VercelBlobStagedAudioStore(" store ", fake.client)).toThrow(
      TypeError,
    );
  });
});
