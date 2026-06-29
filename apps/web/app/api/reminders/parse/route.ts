import { NextRequest } from "next/server";
import { handleParse } from "../../../../lib/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: NextRequest) {
  return handleParse(req);
}
