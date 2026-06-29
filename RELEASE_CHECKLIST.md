# ZmanBot Super Release Checklist

## Local Dev

- Run `npm install`.
- Copy `apps/bot/.env.example` to `apps/bot/.env`.
- Copy `apps/web/.env.example` to `apps/web/.env`.
- Set `TELEGRAM_BOT_TOKEN` only in local `.env` or hosting secrets.
- Run `npm run dev`.
- Verify dashboard at `http://localhost:3000`.

## Production Deployment

- Deploy `apps/web` to Vercel Hobby.
- Set `DATABASE_URL` from Neon Free.
- Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`, `API_SECRET`, `DASHBOARD_PASSWORD`, and `TZ=Asia/Jerusalem`.
- Leave `NEXT_PUBLIC_API_SECRET` unset.
- Configure Telegram webhook to `/api/telegram/webhook`.
- Configure cron-job.org to call `/api/scheduler/run?secret=CRON_SECRET` every minute.

## Telegram QA

- `/start` responds.
- `/id` returns the Chat ID.
- Natural Hebrew reminder creation works.
- `/list`, `/today`, `/tomorrow`, `/week`, `/recurring`, `/overdue`, `/completed`, `/stats` work.
- Done, snooze, and cancel buttons update the database.
- Duplicate Telegram updates do not create duplicate reminders.

## Dashboard QA

- Login works with `DASHBOARD_PASSWORD`.
- Chat ID from `/id` loads the same reminders as Telegram.
- Create, edit, done, snooze, cancel, delete, search, filter, export, and import work.
- Debug sync shows database mode, status counts, and latest reminders.
- Calendar, stats, reminders, today, tomorrow, week, recurring, overdue, done, cancelled, settings pages render on mobile and desktop.

## Security

- `.env`, `node_modules`, `.next`, `dist`, `data/*.db`, logs, and secrets are not committed.
- `TELEGRAM_BOT_TOKEN`, `API_SECRET`, `CRON_SECRET`, and `DASHBOARD_PASSWORD` are only in environment variables.
- `/api/health` is public.
- `/api/telegram/webhook` requires `TELEGRAM_WEBHOOK_SECRET`.
- `/api/scheduler/run` requires `CRON_SECRET`.
- Dashboard APIs require a dashboard cookie or `Authorization: Bearer API_SECRET`.

## Before Sharing Publicly

- Run `npm run test`.
- Run `npm run lint`.
- Run `npm run build`.
- Verify Vercel deployment is on the latest commit.
- Test one real reminder end to end from Telegram to dashboard and back.
- Add screenshots to the README section if desired.
