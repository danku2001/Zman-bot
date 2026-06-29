# Security Policy

## Never Commit Secrets

Never commit `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `DATABASE_URL`, `API_SECRET`, `CRON_SECRET`, `DASHBOARD_PASSWORD`, real `.env` files, SQLite databases, logs, or deployment secrets.

This repository includes `.env.example` files only. Real values belong in local `.env` files or in your hosting provider's environment variables.

## If a Telegram Token Leaks

1. Open Telegram and talk to `@BotFather`.
2. Send `/mybots`.
3. Choose the affected bot.
4. Open **API Token**.
5. Use **Revoke current token** to rotate it.
6. Update `TELEGRAM_BOT_TOKEN` locally and in production.
7. Redeploy or restart the service.

Assume anyone with the old token could control the bot until it is revoked.

## Safe .env Usage

Create local files from the examples:

```bash
cp apps/bot/.env.example apps/bot/.env
cp apps/web/.env.example apps/web/.env
```

Keep real values only in local `.env` files or provider secrets:

```env
TELEGRAM_BOT_TOKEN=...
API_SECRET=...
DATABASE_URL=...
CRON_SECRET=...
DASHBOARD_PASSWORD=...
```

Do not paste secrets into README files, GitHub issues, screenshots, logs, or commits.

## API_SECRET

`/health` is public. If `API_SECRET` is set, all `/api/*` endpoints require:

```http
Authorization: Bearer YOUR_API_SECRET
```

For the Vercel deployment, keep `/api/*` same-origin and do not expose server secrets to browser JavaScript. Use `DASHBOARD_PASSWORD` for the dashboard login cookie and `CRON_SECRET` for `/api/scheduler/run`.
