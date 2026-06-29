import { claimProcessedUpdate } from "./db";
import { processTelegramUpdate, type TelegramUpdate } from "./telegram";

export type WebhookDeps = {
  claimUpdate?: (updateId: string, chatId?: string | null) => Promise<boolean>;
  processUpdate?: (update: TelegramUpdate) => Promise<void>;
};

function chatIdFromUpdate(update: TelegramUpdate): string | null {
  const value = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
  return value === undefined ? null : String(value);
}

export async function handleTelegramWebhookUpdate(update: TelegramUpdate, deps: WebhookDeps = {}): Promise<{ ok: true; duplicate: boolean }> {
  const claimUpdate = deps.claimUpdate ?? claimProcessedUpdate;
  const processUpdate = deps.processUpdate ?? processTelegramUpdate;
  const updateId = String(update.update_id);
  const claimed = await claimUpdate(updateId, chatIdFromUpdate(update));
  if (!claimed) return { ok: true, duplicate: true };
  await processUpdate(update);
  return { ok: true, duplicate: false };
}
