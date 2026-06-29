import { NextRequest } from "next/server";
import { handleEvents } from "../../../lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return handleEvents(req);
}
