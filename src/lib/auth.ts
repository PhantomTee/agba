import type { NextRequest } from "next/server";
import { getEnv, getOptionalEnv } from "./env";

export function assertCronRequest(request: NextRequest) {
  const secret = getOptionalEnv("CRON_SECRET");
  if (!secret) return;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-cron-secret");
  if (provided !== secret) {
    throw new Error("Unauthorized cron request");
  }
}

export function assertAdminRequest(request: NextRequest) {
  const expected = getEnv("ADMIN_API_KEY");
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-admin-api-key");
  if (provided !== expected) {
    throw new Error("Unauthorized admin request");
  }
}
