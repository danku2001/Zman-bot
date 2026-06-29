import { NextRequest } from "next/server";
import { json } from "../../../../lib/server/api";
import { runSchedulerOnce } from "../../../../lib/server/scheduler";

export const runtime = "nodejs";
export const maxDuration = 30;

function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.nextUrl.searchParams.get("secret") === expected || req.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return json({ error: "Unauthorized" }, 401);
  return json(await runSchedulerOnce());
}

export async function POST(req: NextRequest) {
  return GET(req);
}
