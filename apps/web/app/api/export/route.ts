import { NextRequest } from "next/server";
import { handleExport } from "../../../lib/server/api";

export const runtime = "nodejs";

export function GET(req: NextRequest) {
  return handleExport(req);
}
