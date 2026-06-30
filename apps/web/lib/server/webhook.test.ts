import assert from "node:assert/strict";
import test from "node:test";
import { handleTelegramWebhookUpdate } from "./webhook";
import { POST } from "../../app/api/telegram/webhook/route";
import type { TelegramUpdate } from "./telegram";

test("same update_id is processed only once", async () => {
  const seen = new Set<string>();
  let processed = 0;
  const update: TelegramUpdate = {
    update_id: 123,
    message: { message_id: 1, chat: { id: "chat-1" }, text: "תזכיר לי עוד חמש דקות לבדוק" }
  };

  const first = await handleTelegramWebhookUpdate(update, {
    claimUpdate: async (updateId) => {
      if (seen.has(updateId)) return false;
      seen.add(updateId);
      return true;
    },
    markProcessed: async () => {},
    processUpdate: async () => {
      processed += 1;
    }
  });
  const second = await handleTelegramWebhookUpdate(update, {
    claimUpdate: async (updateId) => {
      if (seen.has(updateId)) return false;
      seen.add(updateId);
      return true;
    },
    markProcessed: async () => {},
    processUpdate: async () => {
      processed += 1;
    }
  });

  assert.deepEqual(first, { ok: true, duplicate: false });
  assert.deepEqual(second, { ok: true, duplicate: true });
  assert.equal(processed, 1);
});

test("duplicate webhook call returns ok and does not create duplicate reminders", async () => {
  let createdReminders = 0;
  const update: TelegramUpdate = {
    update_id: 456,
    message: { message_id: 1, chat: { id: "chat-1" }, text: "תזכיר לי עוד חמש דקות לבדוק" }
  };

  await handleTelegramWebhookUpdate(update, {
    claimUpdate: async () => true,
    markProcessed: async () => {},
    processUpdate: async () => {
      createdReminders += 1;
    }
  });
  const duplicate = await handleTelegramWebhookUpdate(update, {
    claimUpdate: async () => false,
    processUpdate: async () => {
      createdReminders += 1;
    }
  });

  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(createdReminders, 1);
});

test("duplicate webhook call does not ask follow-up questions again", async () => {
  let replies = 0;
  const update: TelegramUpdate = {
    update_id: 789,
    message: { message_id: 1, chat: { id: "chat-1" }, text: "משימה בלי זמן" }
  };

  await handleTelegramWebhookUpdate(update, {
    claimUpdate: async () => true,
    markProcessed: async () => {},
    processUpdate: async () => {
      replies += 1;
    }
  });
  await handleTelegramWebhookUpdate(update, {
    claimUpdate: async () => false,
    processUpdate: async () => {
      replies += 1;
    }
  });

  assert.equal(replies, 1);
});

test("failed processing marks update failed and rethrows for Telegram retry", async () => {
  let failedUpdate = "";
  let failedError = "";
  const update: TelegramUpdate = {
    update_id: 999,
    message: { message_id: 1, chat: { id: "chat-1" }, text: "/start" }
  };

  await assert.rejects(() => handleTelegramWebhookUpdate(update, {
    claimUpdate: async () => true,
    markFailed: async (updateId, error) => {
      failedUpdate = updateId;
      failedError = error;
    },
    processUpdate: async () => {
      throw new Error("telegram temporary failure");
    }
  }), /telegram temporary failure/u);

  assert.equal(failedUpdate, "999");
  assert.equal(failedError, "telegram temporary failure");
});

test("processed update does not return 500 when processed marker write fails", async () => {
  let processed = 0;
  let failed = 0;
  const update: TelegramUpdate = {
    update_id: 1001,
    message: { message_id: 1, chat: { id: "chat-1" }, text: "תזכיר לי עוד חמש דקות לבדוק" }
  };

  const result = await handleTelegramWebhookUpdate(update, {
    claimUpdate: async () => true,
    markProcessed: async () => {
      throw new Error("processed marker write failed");
    },
    markFailed: async () => {
      failed += 1;
    },
    processUpdate: async () => {
      processed += 1;
    }
  });

  assert.deepEqual(result, { ok: true, duplicate: false });
  assert.equal(processed, 1);
  assert.equal(failed, 0);
});

test("Telegram webhook route returns 500 when processing throws so Telegram retries", async () => {
  const req = new Request("https://example.test/api/telegram/webhook", {
    method: "POST",
    body: JSON.stringify({
      update_id: 999,
      message: { message_id: 1, chat: { id: "chat-1" }, text: "/start" }
    })
  });

  const response = await POST(req as Parameters<typeof POST>[0]);

  assert.equal(response.status, 500);
});
