import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { JwtTokenService } from "@/src/infrastructure/auth/jwt-token-service";

const SECRET = "non-secret-test-key";
const USER_ID = "9bf158c4-5c67-44a7-99a3-e2b74c34a97d";
const NOW = new Date("2026-09-02T12:00:00.000Z");

describe("JwtTokenService", () => {
  const service = new JwtTokenService({
    secret: SECRET,
    expirationMinutes: 60,
    now: () => NOW,
  });

  it("issues and verifies the existing sub/iat/exp HS256 contract", async () => {
    const token = await service.issue(USER_ID);
    await expect(service.verify(token)).resolves.toBe(USER_ID);
  });

  it("accepts a PyJWT-compatible token", async () => {
    const issuedAt = Math.floor(NOW.getTime() / 1_000);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(USER_ID)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 3_600)
      .sign(new TextEncoder().encode(SECRET));

    await expect(service.verify(token)).resolves.toBe(USER_ID);
  });

  it("rejects expired, malformed, and non-UUID subjects", async () => {
    const key = new TextEncoder().encode(SECRET);
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(USER_ID)
      .setIssuedAt(1)
      .setExpirationTime(2)
      .sign(key);
    const badSubject = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("not-a-uuid")
      .setIssuedAt(Math.floor(NOW.getTime() / 1_000))
      .setExpirationTime(Math.floor(NOW.getTime() / 1_000) + 60)
      .sign(key);

    await expect(service.verify(expired)).resolves.toBeNull();
    await expect(service.verify(badSubject)).resolves.toBeNull();
    await expect(service.verify("not-a-jwt")).resolves.toBeNull();
  });
});
