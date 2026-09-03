import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { InvalidToken } from "@/src/application/errors";
import type { UserAccount } from "@/src/domain/user";
import { getApplicationContainer } from "@/src/bootstrap/container";

export const SESSION_COOKIE_NAME = "session";

export const getCurrentUser = cache(async (): Promise<UserAccount | null> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    return await getApplicationContainer().resolveSession.execute(token);
  } catch (error) {
    if (error instanceof InvalidToken) return null;
    throw error;
  }
});

export async function requireCurrentUser(): Promise<UserAccount> {
  const user = await getCurrentUser();
  if (user === null) redirect("/auth");
  return user;
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: await isSecureRequest(),
    sameSite: "lax",
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE_NAME, "", {
    expires: new Date(0),
    httpOnly: true,
    secure: await isSecureRequest(),
    sameSite: "lax",
    path: "/",
  });
}

async function isSecureRequest(): Promise<boolean> {
  return (
    process.env.VERCEL === "1" ||
    (await headers()).get("x-forwarded-proto") === "https"
  );
}
