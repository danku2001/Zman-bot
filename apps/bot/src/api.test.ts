import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.TZ = "Asia/Jerusalem";
process.env.API_SECRET = "test-api-secret";
process.env.DATABASE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "zmanbot-api-test-")), "reminders.db");

const { createApiApp } = require("./api") as typeof import("./api");

async function withServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = http.createServer(createApiApp());
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start test server");
  try {
    return await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("health stays public while api routes require API_SECRET", async () => {
  await withServer(async (baseUrl) => {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);

    const unauthorized = await fetch(`${baseUrl}/api/reminders?chat_id=test-chat`);
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`${baseUrl}/api/reminders?chat_id=test-chat`, {
      headers: { Authorization: "Bearer test-api-secret" }
    });
    assert.equal(authorized.status, 200);
  });
});

test("api import validates json items", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-api-secret"
      },
      body: JSON.stringify({
        chat_id: "test-chat",
        reminders: [
          { task: "תזכורת תקינה", dueAt: "2026-07-01T09:00:00", recurrence: null },
          { task: "", dueAt: "2026-07-01T09:00:00" },
          { task: "תאריך שבור", dueAt: "not-a-date" }
        ]
      })
    });
    const data = await response.json() as { importedCount: number; errors: string[] };
    assert.equal(response.status, 201);
    assert.equal(data.importedCount, 1);
    assert.equal(data.errors.length, 2);
  });
});
