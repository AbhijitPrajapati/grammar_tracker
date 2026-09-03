import "server-only";

import { jwtVerify, SignJWT } from "jose";

import type { TokenService } from "@/src/core/application/ports/services";
import type { UserId } from "@/src/core/domain/user";

export interface JwtTokenServiceOptions {
  readonly secret: string;
  readonly expirationMinutes: number;
  readonly now?: () => Date;
}

export class JwtTokenService implements TokenService {
  private readonly key: Uint8Array;
  private readonly expirationSeconds: number;
  private readonly now: () => Date;

  constructor(options: JwtTokenServiceOptions) {
    this.key = new TextEncoder().encode(options.secret);
    this.expirationSeconds = options.expirationMinutes * 60;
    this.now = options.now ?? (() => new Date());
  }

  async issue(userId: UserId): Promise<string> {
    const issuedAt = Math.floor(this.now().getTime() / 1_000);
    return new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + this.expirationSeconds)
      .sign(this.key);
  }

  async verify(token: string): Promise<UserId | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ["HS256"],
        currentDate: this.now(),
      });
      return typeof payload.sub === "string" && isUuid(payload.sub)
        ? payload.sub
        : null;
    } catch {
      return null;
    }
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
