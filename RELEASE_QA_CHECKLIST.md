# Release QA Checklist

- [ ] Telegram `/start` answers.
- [ ] Telegram `/id` returns the correct chat ID.
- [ ] Telegram creates a reminder.
- [ ] Dashboard shows the Telegram reminder for the same chat ID.
- [ ] Dashboard creates a reminder.
- [ ] Scheduler sends the dashboard reminder to Telegram.
- [ ] Done sync works from Telegram to dashboard.
- [ ] Done sync works from dashboard to Telegram `/completed`.
- [ ] Snooze sync works both ways.
- [ ] Cancel sync works both ways.
- [ ] Delete works from dashboard.
- [ ] Webhook secret rejects unauthorized requests.
- [ ] Scheduler secret rejects unauthorized requests.
- [ ] Dashboard auth protects dashboard API routes.
- [ ] Mobile dashboard layout is usable.
- [ ] No secrets are exposed in GitHub.
- [ ] README is accurate.
- [ ] Free deployment docs are accurate.
- [ ] cron-job.org calls `/api/scheduler/run` every minute and gets HTTP 200.
- [ ] Dashboard and Telegram display the same Israel wall-clock due time.

