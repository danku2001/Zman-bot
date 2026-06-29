# פריסה חינמית ל-ZmanBot

המטרה: להריץ את ZmanBot 24/7 בלי שירותים בתשלום.

הארכיטקטורה החינמית:

- GitHub - קוד מקור.
- Vercel Hobby - דשבורד, API routes, ו-Telegram webhook.
- Neon Free Postgres - מסד נתונים קבוע.
- cron-job.org Free - קריאה ל-scheduler כל דקה.
- Telegram Bot API - שליחת וקבלת הודעות.

אין צורך ב-Render, Docker, Supabase, OpenAI, או דיסק בתשלום.

## 1. GitHub

1. ודאו שאין `.env` או secrets ב-Git.
2. הריצו:

```bash
npm run test
npm run lint
npm run build
```

3. דחפו את הריפו ל-GitHub.

## 2. Neon Free

1. פתחו חשבון ב-Neon.
2. צרו פרויקט חדש בתוכנית Free.
3. העתיקו את `DATABASE_URL`.
4. אין צורך להריץ migration ידני: ה-API של Vercel יוצר את הטבלאות והאינדקסים אוטומטית בקריאה הראשונה.
5. הטבלאות שנוצרות:
   - `reminders`
   - `reminder_events`

## 3. Vercel Free

1. ב-Vercel בחרו Import Project מהריפו ב-GitHub.
2. הגדירו Root Directory:

```text
apps/web
```

3. הוסיפו Environment Variables:

```env
DATABASE_URL=postgresql://...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=בחרו_מחרוזת_חזקה
API_SECRET=בחרו_מחרוזת_חזקה
CRON_SECRET=בחרו_מחרוזת_חזקה
DASHBOARD_PASSWORD=סיסמה_לדשבורד
TZ=Asia/Jerusalem
```

4. אל תגדירו `NEXT_PUBLIC_API_SECRET`.
5. בפרודקשן מומלץ להשאיר `NEXT_PUBLIC_API_URL` ריק, כדי שהדשבורד ישתמש ב-API routes באותו domain.
6. פרסו את הפרויקט.
7. בדקו:

```text
https://YOUR_VERCEL_DOMAIN/api/health
```

התשובה צריכה להיות:

```json
{ "ok": true, "service": "zmanbot", "mode": "vercel" }
```

## 4. Telegram Webhook

אחרי שיש כתובת Vercel, הגדירו מקומית:

```bash
export TELEGRAM_BOT_TOKEN="..."
export TELEGRAM_WEBHOOK_SECRET="..."
export TELEGRAM_WEBHOOK_URL="https://YOUR_VERCEL_DOMAIN/api/telegram/webhook"
npm run telegram:set-webhook
```

הסקריפט לא מדפיס את הטוקן.

למחיקת webhook וחזרה ל-long polling מקומי:

```bash
export TELEGRAM_BOT_TOKEN="..."
npm run telegram:delete-webhook
```

ה-webhook בודק את header:

```http
X-Telegram-Bot-Api-Secret-Token
```

## 5. cron-job.org

Vercel Hobby לא מתאים ל-cron כל דקה, לכן משתמשים ב-cron-job.org.

1. פתחו חשבון חינמי ב-cron-job.org.
2. צרו cron job חדש.
3. הגדירו Schedule: פעם בדקה.
4. Method: `GET`.
5. URL:

```text
https://YOUR_VERCEL_DOMAIN/api/scheduler/run?secret=CRON_SECRET
```

6. Timeout: פחות מ-30 שניות.
7. שמרו והפעילו.

תשובה תקינה:

```json
{
  "ok": true,
  "sent": 0,
  "recovered": 0,
  "failed": 0
}
```

## 6. בדיקות QA

1. שלחו לבוט `/start`.
2. שלחו `/id`.
3. שלחו:

```text
תזכיר לי עוד דקה לבדוק
```

4. ודאו שהודעת התזכורת מגיעה אחרי הקריאה הבאה של cron-job.org.
5. היכנסו לדשבורד ב-Vercel.
6. בדקו שהתזכורות מופיעות.
7. בדקו `done`, `snooze`, ו-`cancel`.
8. בדקו export/import במסך Settings.

## 7. פיתוח מקומי

פיתוח מקומי נשאר כמו קודם:

```bash
npm install
npm run dev
```

מצב מקומי יכול להשתמש ב:

- SQLite דרך `apps/bot`
- polling bot
- Express API מקומי
- דשבורד עם `NEXT_PUBLIC_API_URL=http://localhost:4000`

מצב פרודקשן משתמש ב:

- Vercel serverless API routes
- Telegram webhook
- Neon Postgres
- cron-job.org

## 8. מגבלות חינמיות

- Vercel Hobby חינמי לפרויקטים אישיים, אבל יש לו מגבלות שימוש וזמן ריצה.
- Neon Free כולל מגבלות storage/compute.
- cron-job.org הוא cron חיצוני חינמי; דיוק הדקה תלוי בו.
- ייתכנו cold starts.
- אם הופכים את ZmanBot למוצר ציבורי עם הרבה משתמשים, ייתכן שבעתיד יהיה צורך בתשתית בתשלום.
