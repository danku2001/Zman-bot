import { NextRequest } from "next/server";
import { handleReminderAction } from "../../../../lib/server/api";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleReminderAction(req, await params, "update");
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleReminderAction(req, await params, "delete");
}
