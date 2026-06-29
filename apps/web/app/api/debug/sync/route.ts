import { NextRequest } from "next/server";
import { handleSyncDebug } from "../../../../lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return handleSyncDebug(req);
}
