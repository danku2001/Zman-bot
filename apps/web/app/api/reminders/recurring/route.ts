import { NextRequest } from "next/server";
import { handleGetReminders } from "../../../../lib/server/api";

export const runtime = "nodejs";

export function GET(req: NextRequest) {
  return handleGetReminders(req, "recurring");
}
