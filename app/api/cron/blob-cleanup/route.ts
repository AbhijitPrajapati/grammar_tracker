import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { getApplicationContainer } from "@/src/bootstrap/container";
import { getServerEnvironment } from "@/src/infrastructure/config/env";
import { getLogger } from "@/src/infrastructure/observability/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  const environment = getServerEnvironment();
  if (
    !hasValidCronAuthorization(
      request.headers.get("authorization"),
      environment.cronSecret,
    )
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await getApplicationContainer().cleanupAbandonedAudio.execute();

  getLogger().info(
    { operation: "cleanup_staged_audio", ...result },
    "Staged audio cleanup completed",
  );
  return NextResponse.json(result);
}

export function hasValidCronAuthorization(
  authorization: string | null,
  secret: string,
): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}
