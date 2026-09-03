import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { InvalidToken } from "@/src/core/application/errors";
import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  getCurrentUser,
  setSessionCookie,
} from "@/src/adapters/inbound/next/session";

const originalVercel = process.env.VERCEL;

const doubles = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  headerGet: vi.fn(),
  resolveSession: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <Arguments extends unknown[], Result>(
    callback: (...arguments_: Arguments) => Result,
  ) => callback,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: doubles.cookieGet,
    set: doubles.cookieSet,
  }),
  headers: async () => ({ get: doubles.headerGet }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/src/bootstrap/container", () => ({
  getApplicationContainer: () => ({
    resolveSession: { execute: doubles.resolveSession },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.VERCEL;
  doubles.headerGet.mockReturnValue(null);
});

afterAll(() => {
  if (originalVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalVercel;
});

describe("Next session adapter", () => {
  it("resolves the cookie through the use case and rechecks the user", async () => {
    const account = { id: "4fcd2c4d-c90b-4202-8b1f-f59cf95cced6" };
    doubles.cookieGet.mockReturnValue({ value: "signed-session" });
    doubles.resolveSession.mockResolvedValue(account);

    await expect(getCurrentUser()).resolves.toBe(account);
    expect(doubles.cookieGet).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
    expect(doubles.resolveSession).toHaveBeenCalledWith("signed-session");
  });

  it("treats a missing or invalid session as anonymous but propagates outages", async () => {
    doubles.cookieGet.mockReturnValue(undefined);
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(doubles.resolveSession).not.toHaveBeenCalled();

    doubles.cookieGet.mockReturnValue({ value: "invalid-session" });
    doubles.resolveSession.mockRejectedValueOnce(new InvalidToken());
    await expect(getCurrentUser()).resolves.toBeNull();

    doubles.resolveSession.mockRejectedValueOnce(new Error("database offline"));
    await expect(getCurrentUser()).rejects.toThrow("database offline");
  });

  it("sets an HttpOnly lax session cookie without making it persistent", async () => {
    await setSessionCookie("signed-session");

    expect(doubles.cookieSet).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      "signed-session",
      {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
      },
    );
  });

  it("marks cookies secure on Vercel or an HTTPS request", async () => {
    process.env.VERCEL = "1";
    await setSessionCookie("vercel-session");
    expect(doubles.cookieSet.mock.calls[0]?.[2]).toMatchObject({ secure: true });

    vi.clearAllMocks();
    delete process.env.VERCEL;
    doubles.headerGet.mockReturnValue("https");
    await setSessionCookie("https-session");
    expect(doubles.cookieSet.mock.calls[0]?.[2]).toMatchObject({ secure: true });
  });

  it("expires the same cookie attributes when clearing a session", async () => {
    process.env.VERCEL = "1";
    await clearSessionCookie();

    expect(doubles.cookieSet).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      "",
      {
        expires: new Date(0),
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      },
    );
  });
});
