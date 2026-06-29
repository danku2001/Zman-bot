const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = process.env.APP_URL?.replace(/\/$/, "");
const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL ?? (appUrl ? `${appUrl}/api/telegram/webhook` : "");
const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token || !webhookUrl || !secretToken) {
  console.error("Missing TELEGRAM_BOT_TOKEN, APP_URL or TELEGRAM_WEBHOOK_URL, or TELEGRAM_WEBHOOK_SECRET");
  process.exit(1);
}

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: webhookUrl,
    secret_token: secretToken,
    allowed_updates: ["message", "callback_query"]
  })
});

const data = await response.json();
if (!response.ok || !data.ok) {
  console.error("Failed to set Telegram webhook");
  process.exit(1);
}
console.log("Telegram webhook configured.");
