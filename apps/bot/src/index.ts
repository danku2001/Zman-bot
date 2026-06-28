import { createApiApp } from "./api";
import { bot } from "./bot";
import { config } from "./config";
import "./db";
import { logger } from "./logger";
import { startScheduler } from "./scheduler";

async function main(): Promise<void> {
  let telegramStarted = false;
  const app = createApiApp();
  app.listen(config.port, () => logger.info("API server started", { port: config.port }));

  if (!config.telegramBotToken) {
    logger.warn("TELEGRAM_BOT_TOKEN is missing. API will run, but Telegram polling will not start.");
  } else {
    void bot.telegram
      .getMe()
      .then((botInfo) => {
        void bot.launch().catch((error) => {
          telegramStarted = false;
          logger.error("Telegram polling stopped or failed.", { error });
        });
        telegramStarted = true;
        startScheduler(bot);
        logger.info("Telegram bot started", { username: botInfo.username });
      })
      .catch((error) => {
        logger.error("Failed to start Telegram bot. API is still running.", { error });
      });
  }

  const stopTelegram = (signal: "SIGINT" | "SIGTERM") => {
    if (!telegramStarted) return;
    try {
      bot.stop(signal);
    } catch (error) {
      logger.warn("Telegram bot was not running during shutdown", { error });
    }
  };

  process.once("SIGINT", () => {
    stopTelegram("SIGINT");
    process.exit(0);
  });
  process.once("SIGTERM", () => {
    stopTelegram("SIGTERM");
    process.exit(0);
  });
}

void main().catch((error) => {
  logger.error("Fatal startup error", { error });
  process.exit(1);
});
