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
   - `processed_updates`

## 3. Vercel Free

1. ב-Vercel בחרו Import Project מהריפו ב-GitHub.
2. הגדירו Root Directory:

```text
apps/web
```

3. הוסיפו Environment Variables:

```env
APP_URL=https://YOUR_VERCEL_DOMAIN
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

### אבטחת דשבורד ו-API

- `DASHBOARD_PASSWORD` מגן על ממשק הדשבורד.
- אחרי login נוצר cookie מסוג HTTP-only. הדשבורד משתמש ב-cookie הזה כדי לגשת ל-`/api/reminders`, `/api/stats`, `/api/export`, ו-`/api/import`.
- `API_SECRET` מיועד לגישה חיצונית ל-API, למשל סקריפט ניהול, דרך:

```http
Authorization: Bearer API_SECRET
```

- לא לחשוף `API_SECRET` בדפדפן ולא להגדיר `NEXT_PUBLIC_API_SECRET`.
- `/api/health` ציבורי.
- `/api/telegram/webhook` מוגן על ידי `TELEGRAM_WEBHOOK_SECRET`.
- `/api/scheduler/run` מוגן על ידי `CRON_SECRET`.

## 4. Telegram Webhook

אחרי שיש כתובת Vercel, הגדירו מקומית:

```bash
export TELEGRAM_BOT_TOKEN="..."
export TELEGRAM_WEBHOOK_SECRET="..."
export APP_URL="https://YOUR_VERCEL_DOMAIN"
npm run telegram:set-webhook
```

אפשר גם להגדיר `TELEGRAM_WEBHOOK_URL` מלא ידנית; אם הוא לא מוגדר, הסקריפט יבנה אותו מתוך `APP_URL`.

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
חשוב: בלי השלב הזה הבוט יענה שהוא קבע תזכורת, אבל אף שרת לא “יתעורר” בזמן כדי לשלוח אותה.

1. פתחו חשבון חינמי ב-cron-job.org.
2. צרו cron job חדש.
3. הגדירו Schedule: פעם בדקה.
4. Method: `GET`.
5. URL:

```text
https://YOUR_VERCEL_DOMAIN/api/scheduler/run?secret=CRON_SECRET
```

ה-endpoint מקבל גם `?cron_secret=CRON_SECRET`, `?token=CRON_SECRET`, header בשם `x-cron-secret`, או `Authorization: Bearer CRON_SECRET`.
בנוסף, קריאות שמגיעות מ-cron-job.org מזוהות לפי User-Agent כדי למנוע מצב שבו job קיים אך נופל בגלל header חסר. עדיין מומלץ להשאיר את ה-`secret` ב-URL.

6. Timeout: פחות מ-30 שניות.
7. שמרו והפעילו.
8. ודאו שה-job פעיל ומחזיר HTTP 200. אם הוא מחזיר 401, ה-`CRON_SECRET` ב-URL לא תואם למה שמוגדר ב-Vercel.

תשובה תקינה:

```json
{
  "ok": true,
  "sent": 0,
  "recovered": 0,
  "failed": 0,
  "durationMs": 123
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
8. בדקו `/week` וודאו שמשימות שבוצעו לא מופיעות; בדקו `/completed` כדי לראות אותן בנפרד.
9. בדקו export/import במסך Settings.
10. במסך reminders לחצו `בדוק סנכרון` וודאו שה-counts תואמים ל-Chat ID.
11. במסך Settings לחצו `בדוק עכשיו`. אם מופיע "תזכורות שעבר זמנן ועדיין לא נשלחו" עם מספר גדול מ-0, הבעיה היא ש-cron-job.org לא מפעיל את `/api/scheduler/run` כל דקה.

## 7. Debug Sync

אם תזכורת שנוצרה בטלגרם לא מופיעה בדשבורד:

1. ודאו שהזנתם בדשבורד את ה-ID מהפקודה `/id` בטלגרם.
2. פתחו את `/reminders`.
3. לחצו `בדוק סנכרון`.
4. בדקו:
   - `chatId` שהתקבל.
   - `total`.
   - counts לפי `pending`, `sending`, `notified`, `done`, `cancelled`.
   - חמש התזכורות האחרונות.
   - `databaseMode` צריך להיות `postgres` בפרודקשן.

אפשר לבדוק גם ישירות:

```text
https://YOUR_VERCEL_DOMAIN/api/debug/sync?chat_id=YOUR_CHAT_ID
```

ה-endpoint מוגן על ידי cookie של הדשבורד או `Authorization: Bearer API_SECRET`, ולא מחזיר secrets.

## 8. פיתוח מקומי

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

## 9. מגבלות חינמיות

- Vercel Hobby חינמי לפרויקטים אישיים, אבל יש לו מגבלות שימוש וזמן ריצה.
- Neon Free כולל מגבלות storage/compute.
- cron-job.org הוא cron חיצוני חינמי; דיוק הדקה תלוי בו.
- ייתכנו cold starts.
- אם הופכים את ZmanBot למוצר ציבורי עם הרבה משתמשים, ייתכן שבעתיד יהיה צורך בתשתית בתשלום.
