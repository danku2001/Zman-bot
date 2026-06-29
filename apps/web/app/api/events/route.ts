import { NextRequest } from "next/server";
import { handleEvents } from "../../../lib/server/api";

export const runtime = "nodejs";

export function GET(req: NextRequest) {
  return handleEvents(req);
}
