import { NextRequest } from "next/server";
import { json } from "../../../../lib/server/api";
import { isSchedulerAuthorized } from "../../../../lib/server/scheduler-auth";
import { runSchedulerOnce } from "../../../../lib/server/scheduler";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

function limitFrom(req: NextRequest): number {
  const raw = Number(req.nextUrl.searchParams.get("limit") ?? 25);
  if (!Number.isInteger(raw)) return 25;
  return Math.max(1, Math.min(raw, 25));
}

export async function GET(req: NextRequest) {
  if (!isSchedulerAuthorized(req)) return json({ error: "Unauthorized" }, 401);
  return json(await runSchedulerOnce(limitFrom(req)));
}

export async function POST(req: NextRequest) {
  return GET(req);
}
