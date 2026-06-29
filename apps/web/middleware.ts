import { NextRequest, NextResponse } from "next/server";

const cookieName = "zmanbot_dashboard";

async function expectedCookie(): Promise<string> {
  const input = new TextEncoder().encode(`zmanbot:${process.env.DASHBOARD_PASSWORD ?? ""}`);
  const hash = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function middleware(req: NextRequest) {
  if (!process.env.DASHBOARD_PASSWORD) return NextResponse.next();
  if (req.nextUrl.pathname === "/login") return NextResponse.next();
  if (req.cookies.get(cookieName)?.value === await expectedCookie()) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
