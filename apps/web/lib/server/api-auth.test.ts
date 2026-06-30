import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { assertApiAccess } from "./api";
import { dashboardCookieName, dashboardCookieValue } from "./auth";
import { isSchedulerAuthorized } from "./scheduler-auth";
import { GET as healthGet } from "../../app/api/health/route";
import { GET as schedulerGet } from "../../app/api/scheduler/run/route";
import { GET as schedulerDebugGet } from "../../app/api/debug/scheduler/route";
import { GET as deliveryDebugGet } from "../../app/api/debug/delivery/route";
import { POST as telegramSendPost } from "../../app/api/debug/telegram-send/route";
import { POST as webhookPost } from "../../app/api/telegram/webhook/route";

function request(path: string, headers?: HeadersInit): NextRequest {
  return new NextRequest(`https://zmanbot.test${path}`, { headers });
}

function postRequest(path: string, body: unknown, headers?: HeadersInit): NextRequest {
  return new NextRequest(`https://zmanbot.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
    body: JSON.stringify(body)
  });
}

test("dashboard api access returns 401 with no API_SECRET and no dashboard cookie", () => {
  process.env.API_SECRET = "api-secret";
  process.env.DASHBOARD_PASSWORD = "dashboard-password";

  const blocked = assertApiAccess(request("/api/reminders?chat_id=test-chat"));

  assert.equal(blocked?.status, 401);
});

test("dashboard api access works with Authorization Bearer API_SECRET", () => {
  process.env.API_SECRET = "api-secret";
  process.env.DASHBOARD_PASSWORD = "dashboard-password";

  const blocked = assertApiAccess(request("/api/reminders?chat_id=test-chat", { Authorization: "Bearer api-secret" }));

  assert.equal(blocked, null);
});

test("dashboard api access works with valid dashboard cookie", () => {
  process.env.API_SECRET = "api-secret";
  process.env.DASHBOARD_PASSWORD = "dashboard-password";
  const cookie = `${dashboardCookieName}=${dashboardCookieValue()}`;

  const blocked = assertApiAccess(request("/api/reminders?chat_id=test-chat", { Cookie: cookie }));

  assert.equal(blocked, null);
});

test("health stays public", async () => {
  process.env.API_SECRET = "api-secret";
  process.env.DASHBOARD_PASSWORD = "dashboard-password";

  const response = healthGet();
  const body = await response.json() as { ok: boolean };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
});

test("scheduler run still requires CRON_SECRET", async () => {
  process.env.CRON_SECRET = "cron-secret";
  process.env.DASHBOARD_PASSWORD = "dashboard-password";

  const missing = await schedulerGet(request("/api/scheduler/run"));
  const wrong = await schedulerGet(request("/api/scheduler/run?secret=wrong"));

  assert.equal(missing.status, 401);
  assert.equal(wrong.status, 401);
});

test("scheduler debug still requires CRON_SECRET", async () => {
  process.env.CRON_SECRET = "cron-secret";
  process.env.DASHBOARD_PASSWORD = "dashboard-password";

  const missing = await schedulerDebugGet(request("/api/debug/scheduler"));
  const wrong = await schedulerDebugGet(request("/api/debug/scheduler?secret=wrong"));

  assert.equal(missing.status, 401);
  assert.equal(wrong.status, 401);
});

test("delivery debug requires CRON_SECRET", async () => {
  process.env.CRON_SECRET = "cron-secret";

  const missing = await deliveryDebugGet(request("/api/debug/delivery"));
  const wrong = await deliveryDebugGet(request("/api/debug/delivery?secret=wrong"));

  assert.equal(missing.status, 401);
  assert.equal(wrong.status, 401);
});

test("telegram send debug requires CRON_SECRET", async () => {
  process.env.CRON_SECRET = "cron-secret";

  const missing = await telegramSendPost(postRequest("/api/debug/telegram-send", { chat_id: "123" }));
  const wrong = await telegramSendPost(postRequest("/api/debug/telegram-send?secret=wrong", { chat_id: "123" }));

  assert.equal(missing.status, 401);
  assert.equal(wrong.status, 401);
});

test("telegram send debug sends with valid CRON_SECRET", async () => {
  process.env.CRON_SECRET = "cron-secret";
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  const previousFetch = global.fetch;
  const sentBodies: unknown[] = [];
  global.fetch = (async (_url, init) => {
    sentBodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 });
  }) as typeof fetch;

  try {
    const response = await telegramSendPost(postRequest("/api/debug/telegram-send?secret=cron-secret", { chat_id: "123" }));
    const body = await response.json() as { ok: boolean; telegramStatus: string };

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.telegramStatus, "sent");
    assert.deepEqual(sentBodies[0], { chat_id: "123", text: "בדיקת שליחה מ-ZmanBot ✅" });
  } finally {
    global.fetch = previousFetch;
  }
});

test("scheduler run accepts cron-job compatible secret formats", async () => {
  process.env.CRON_SECRET = "cron-secret";

  const querySecret = isSchedulerAuthorized(request("/api/scheduler/run?secret=cron-secret&limit=1"));
  const queryCronSecret = isSchedulerAuthorized(request("/api/scheduler/run?cron_secret=cron-secret&limit=1"));
  const queryToken = isSchedulerAuthorized(request("/api/scheduler/run?token=cron-secret&limit=1"));
  const bearer = isSchedulerAuthorized(request("/api/scheduler/run?limit=1", { Authorization: "Bearer cron-secret" }));
  const rawAuthorization = isSchedulerAuthorized(request("/api/scheduler/run?limit=1", { Authorization: "cron-secret" }));
  const headerSecret = isSchedulerAuthorized(request("/api/scheduler/run?limit=1", { "x-cron-secret": "cron-secret" }));

  assert.equal(querySecret, true);
  assert.equal(queryCronSecret, true);
  assert.equal(queryToken, true);
  assert.equal(bearer, true);
  assert.equal(rawAuthorization, true);
  assert.equal(headerSecret, true);
});

test("scheduler run accepts Vercel Cron user agent", () => {
  process.env.CRON_SECRET = "cron-secret";

  const ok = isSchedulerAuthorized(request("/api/scheduler/run", { "user-agent": "vercel-cron/1.0" }));

  assert.equal(ok, true);
});

test("scheduler run accepts cron-job.org user agent", () => {
  process.env.CRON_SECRET = "cron-secret";

  const ok = isSchedulerAuthorized(request("/api/scheduler/run", { "user-agent": "cron-job.org" }));

  assert.equal(ok, true);
});

test("scheduler run accepts valid dashboard cookie for manual diagnostics", () => {
  process.env.CRON_SECRET = "cron-secret";
  process.env.DASHBOARD_PASSWORD = "dashboard-password";
  const cookie = `${dashboardCookieName}=${dashboardCookieValue()}`;

  const ok = isSchedulerAuthorized(request("/api/scheduler/run?limit=1", { Cookie: cookie }));

  assert.equal(ok, true);
});

test("telegram webhook still requires Telegram secret header", async () => {
  process.env.TELEGRAM_WEBHOOK_SECRET = "telegram-secret";

  const response = await webhookPost(new NextRequest("https://zmanbot.test/api/telegram/webhook", {
    method: "POST",
    body: JSON.stringify({ update_id: 1 })
  }));

  assert.equal(response.status, 401);
});
