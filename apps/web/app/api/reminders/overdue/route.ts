import { NextRequest } from "next/server";
import { handleGetReminders } from "../../../../lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return handleGetReminders(req, "overdue");
}
