import crypto from "node:crypto";

export const dashboardCookieName = "zmanbot_dashboard";

export function dashboardEnabled(): boolean {
  return Boolean(process.env.DASHBOARD_PASSWORD);
}

export function dashboardCookieValue(): string {
  const password = process.env.DASHBOARD_PASSWORD ?? "";
  return crypto.createHash("sha256").update(`zmanbot:${password}`).digest("hex");
}
