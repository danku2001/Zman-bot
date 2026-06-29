import { NextRequest } from "next/server";
import { handleCreate, handleGetReminders } from "../../../lib/server/api";

export const runtime = "nodejs";

export function GET(req: NextRequest) {
  return handleGetReminders(req);
}

export function POST(req: NextRequest) {
  return handleCreate(req);
}
