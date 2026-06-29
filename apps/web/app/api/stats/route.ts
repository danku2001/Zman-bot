import { NextRequest } from "next/server";
import { handleStats } from "../../../lib/server/api";

export const runtime = "nodejs";

export function GET(req: NextRequest) {
  return handleStats(req);
}
