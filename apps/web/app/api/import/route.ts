import { NextRequest } from "next/server";
import { handleImport } from "../../../lib/server/api";

export const runtime = "nodejs";

export function POST(req: NextRequest) {
  return handleImport(req);
}
