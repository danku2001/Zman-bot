import { claimTelegramUpdate, markTelegramUpdateFailed, markTelegramUpdateProcessed } from "./db";
import { processTelegramUpdate, type TelegramUpdate } from "./telegram";

export type WebhookDeps = {
  claimUpdate?: (updateId: string, chatId?: string | null) => Promise<boolean>;
  markProcessed?: (updateId: string) => Promise<void>;
  markFailed?: (updateId: string, error: string) => Promise<void>;
  processUpdate?: (update: TelegramUpdate) => Promise<void>;
};

function chatIdFromUpdate(update: TelegramUpdate): string | null {
  const value = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
  return value === undefined ? null : String(value);
}

export async function handleTelegramWebhookUpdate(update: TelegramUpdate, deps: WebhookDeps = {}): Promise<{ ok: true; duplicate: boolean }> {
  const claimUpdate = deps.claimUpdate ?? claimTelegramUpdate;
  const markProcessed = deps.markProcessed ?? markTelegramUpdateProcessed;
  const markFailed = deps.markFailed ?? markTelegramUpdateFailed;
  const processUpdate = deps.processUpdate ?? processTelegramUpdate;
  const updateId = String(update.update_id);
  const claimed = await claimUpdate(updateId, chatIdFromUpdate(update));
  if (!claimed) return { ok: true, duplicate: true };
  try {
    await processUpdate(update);
    try {
      await markProcessed(updateId);
    } catch (error) {
      console.error("Telegram webhook processed but failed to mark update processed", error instanceof Error ? error.message : "Unknown error");
    }
  } catch (error) {
    await markFailed(updateId, error instanceof Error ? error.message : "Unknown webhook error");
    throw error;
  }
  return { ok: true, duplicate: false };
}
