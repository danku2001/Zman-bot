import { json } from "../../../lib/server/api";

export const runtime = "nodejs";

export function GET() {
  return json({ ok: true, service: "zmanbot", mode: "vercel" });
}
