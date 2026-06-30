# ZmanBot QA

## Local automated QA

Run the full local safety net:

```bash
npm run qa
```

This runs lint, unit/integration tests, security checks, build, and the E2E placeholder. The most important integration test is:

```bash
apps/web/lib/server/sync-flow.test.ts
```

It proves:

- Telegram-created reminders are visible through the dashboard API.
- Dashboard-created reminders are picked up by the scheduler.
- Scheduler sends to the same Telegram chat ID.
- Done from Telegram is reflected in dashboard API.
- Done from dashboard is reflected in Telegram `/completed`.

The sync test uses `ZMANBOT_TEST_DB=memory` and mocked Telegram fetch calls. It does not touch production data, Neon, or real Telegram tokens.

## GitHub Actions

Every push and pull request runs `.github/workflows/ci.yml`:

- Node 20
- `npm ci` when `package-lock.json` exists
- `npm run lint`
- `npm run test`
- `npm run test:security`
- `npm run build`

Any failed command fails CI.

## Security QA

Run:

```bash
npm run test:security
```

This checks that real env files and common secret values are not committed, frontend code does not expose `NEXT_PUBLIC_API_SECRET`, frontend API calls do not default to `localhost:4000`, and dashboard fetches include credentials.

## Telegram-dashboard sync manual test

1. Deploy latest `main` to Vercel.
2. Confirm Vercel env vars exist: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `DASHBOARD_PASSWORD`, `API_SECRET`, `CRON_SECRET`.
3. In dashboard Settings, click `תקן Telegram Webhook`.
4. Send `/id` in Telegram and copy the chat ID into the dashboard.
5. Send `תזכיר לי עוד דקה בדיקת סינק`.
6. Confirm the dashboard shows the reminder for the same chat ID.
7. Confirm the shown due time matches Israel wall-clock time.

## Scheduler manual test

The scheduler endpoint is:

```text
https://YOUR_DOMAIN/api/scheduler/run?secret=YOUR_CRON_SECRET
```

For free 24/7 reminders, cron-job.org must call it every minute. Vercel serverless functions do not run continuously by themselves.

Manual dashboard proof:

1. Create a due reminder.
2. Open Settings.
3. Click `הרץ Scheduler`.
4. Confirm Telegram receives the reminder.
5. Confirm the reminder status becomes `notified`.

## Production after deploy

After every deploy:

- Dashboard Settings should show API base `same-origin /api`.
- Health should return `zmanbot / vercel`.
- Database mode should be `postgres`.
- Telegram webhook URL should be `https://YOUR_DOMAIN/api/telegram/webhook`.
- Telegram pending updates should be `0`.
- cron-job.org history should show HTTP `200` every minute.

