const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

const response = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ drop_pending_updates: false })
});

const data = await response.json();
if (!response.ok || !data.ok) {
  console.error("Failed to delete Telegram webhook");
  process.exit(1);
}
console.log("Telegram webhook deleted.");
