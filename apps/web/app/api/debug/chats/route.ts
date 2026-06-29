import { NextRequest } from "next/server";
import { handleKnownChats } from "../../../../lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return handleKnownChats(req);
}
