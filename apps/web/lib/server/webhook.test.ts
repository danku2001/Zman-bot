import assert from "node:assert/strict";
import test from "node:test";
import { handleTelegramWebhookUpdate } from "./webhook";
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
