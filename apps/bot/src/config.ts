import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  apiSecret: process.env.API_SECRET ?? "",
  port: Number(process.env.PORT ?? 4000),
  databasePath: path.resolve(__dirname, "..", process.env.DATABASE_PATH ?? "../../data/reminders.db"),
  timezone: process.env.TZ ?? "Asia/Jerusalem"
};

process.env.TZ = config.timezone;
