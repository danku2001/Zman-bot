# ZmanBot Super Release

ZmanBot הוא בוט תזכורות חכם בעברית לטלגרם, עם דשבורד ניהול ב-Next.js. המשתמש כותב הודעות טבעיות כמו `תזכיר לי מחר ב-9 לשלוח מייל`, והבוט שומר תזכורת ושולח אותה בזמן לפי אזור הזמן `Asia/Jerusalem`.

**Repository description suggestion:** Hebrew Telegram reminder bot with natural-language parsing, recurring reminders, synchronized Next.js RTL dashboard, Neon Postgres, and free Vercel deployment.

**Topics suggestion:** `telegram-bot`, `nextjs`, `typescript`, `hebrew`, `reminders`, `postgres`, `vercel`, `tailwindcss`, `telegraf`

## What I Built

Built a production-ready Hebrew reminder system with Telegram integration, natural-language parsing, persistent storage, scheduled delivery, REST API, authentication, and a responsive RTL dashboard.

## מה בניתי

מערכת תזכורות מלאה בעברית: בוט Telegram, parser לשפה טבעית, תזכורות חוזרות, מסד נתונים קבוע, scheduler לשליחה בזמן, API מאובטח, ודשבורד RTL מסונכרן.

## Screenshots

Screenshots are not committed yet. Recommended captures before sharing publicly:

- Telegram reminder creation and delivery.
- Dashboard home with stats.
- Reminder list with sync debug panel.
- Mobile dashboard view.

## מה יש בפרויקט

- בוט Telegram מבוסס Telegraf
- Parser בעברית לתזכורות חד-פעמיות, יומיות ושבועיות
- SQLite מקומי עם `better-sqlite3`
- Scheduler שרץ כל דקה עם `node-cron`
- Express API מקומי לניהול תזכורות
- Next.js Route Handlers לפריסה חינמית ב-Vercel
- Neon Free Postgres לפרודקשן דרך `DATABASE_URL`
- דשבורד RTL בעברית עם Next.js, TypeScript ו-Tailwind CSS
- מודל סטטוסים מלא: `pending`, `sending`, `notified`, `done`, `cancelled`
- Follow-up reminders: אחרי שליחה הבוט שואל אם ביצעת ומזכיר שוב כל 5 דקות עד 12 פעמים, עד done/snooze/cancel
- Debug sync panel, export/import, event timeline, dashboard login עם HTTP-only cookie

## יצירת בוט בטלגרם

1. פתחו את Telegram וחפשו את `BotFather`.
2. שלחו `/newbot`.
3. בחרו שם לבוט ו-username שמסתיים ב-`bot`.
4. העתיקו את ה-token שקיבלתם.

## התקנה

```bash
cd zmanbot
npm install
```

## הגדרת סביבה

צרו קובץ `apps/bot/.env` לפי הדוגמה:

```bash
cp apps/bot/.env.example apps/bot/.env
```

הכניסו את ה-token:

```env
TELEGRAM_BOT_TOKEN=123456:ABC...
API_SECRET=
PORT=4000
DATABASE_PATH=../../data/reminders.db
TZ=Asia/Jerusalem
```

לדשבורד:

```bash
cp apps/web/.env.example apps/web/.env
```

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

ב-Vercel השאירו `NEXT_PUBLIC_API_URL` ריק כדי שהדשבורד יעבוד מול `/api/*` באותו domain, בלי לחשוף secret לדפדפן.

### משתני סביבה לפרודקשן

```env
DATABASE_URL=postgresql://...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_URL=https://YOUR_DOMAIN/api/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=strong-random-secret
API_SECRET=strong-random-secret
CRON_SECRET=strong-random-secret
DASHBOARD_PASSWORD=strong-dashboard-password
TZ=Asia/Jerusalem
```

## הרצה

להרצת הבוט והדשבורד יחד:

```bash
npm run dev
```

להרצת הבוט בלבד:

```bash
npm run dev:bot
```

להרצת הדשבורד בלבד:

```bash
npm run dev:web
```

ברירת המחדל:

- API ובוט: `http://localhost:4000`
- דשבורד: `http://localhost:3000`

## Before Pushing To GitHub

לפני שמעלים את הפרויקט לריפו ציבורי:

- ודאו שאין קבצי `.env` ב-commit.
- ודאו שאין `TELEGRAM_BOT_TOKEN`, `API_SECRET`, או סודות אחרים בקוד.
- ודאו ש-`node_modules`, `.next`, `dist`, `data/*.db`, וקבצי log מוחרגים ב-`.gitignore`.
- הריצו `npm run test`, `npm run lint`, ו-`npm run build`.
- הגדירו סודות רק ב-Render/GitHub/סביבת השרת, לא בתוך הקוד.
- אם טוקן Telegram דלף, סובבו אותו מיד דרך BotFather.

## הפעלה 24/7 בחינם

לפריסה חינמית מלאה משתמשים ב-Vercel Hobby, Neon Free Postgres, cron-job.org Free, GitHub ו-Telegram Bot API. אין צורך ב-Render, Docker, Supabase, OpenAI, או דיסק בתשלום.

ראו מדריך מלא ב-[docs/FREE_DEPLOYMENT.md](docs/FREE_DEPLOYMENT.md).

## הודעות לבדיקה

```text
תזכיר לי עוד 10 דקות לשתות מים
תזכיר לי עוד דקה לשתות מים
תזכיר לי עוד חמש דקות לבדוק
תזכיר לי בעוד חמש דקות לבדוק
תזכיר לי בעוד רבע שעה לצאת
תזכיר לי בעוד חצי שעה להתקשר
תזכיר לי עוד שעה להתקשר לאמא
תזכיר לי עוד שלוש שעות לבדוק
תזכיר לי עוד שעתיים לחזור ללקוח
תזכיר לי עוד יום לבדוק משהו
תזכיר לי עוד יומיים לבדוק משהו
תזכיר לי עוד שבוע להתקשר
תזכיר לי עוד שבועיים להתקשר
תזכיר לי מחר ב-9 לשלוח מייל
מחר ב-9 תזכיר לי לשלוח מייל
תזכיר לי מחר ב2 בצהריים לעשות משהו
תזכיר לי מחר ב 2 בצהריים לעשות משהו
תזכיר לי מחר 2 בצהריים לעשות משהו
תזכיר לי מחר 14:00 בצהריים לעשות משהו
תזכיר לי מחר ב2 בלילה לעשות משהו
תזכיר לי מחר ב10 בלילה לעשות משהו
תזכיר לי מחר ב12 בלילה לעשות משהו
תזכיר לי מחר בשעה 09:30 לשלוח מייל
תזכיר לי מחר בשעה שתיים בצהריים לעשות ככה ככה וככה
תזכיר לי מחר בשעה שתיים וחצי בצהריים פגישה
ב11 למאי תזכיר לי לשלוח מזל טוב לדני
תזכיר לי לשלוח מזל טוב לדני ב11 למאי
תזכיר לי 11/5 לשלוח מזל טוב
תזכיר לי בתאריך 11.8 ב2 בצהריים להתקשר לרופא
קבעתי פגישה לעוד חודשיים עם רוני תזכיר לי
תזכיר לי בעוד 3 חודשים לחדש מנוי
תזכיר לי בעוד שנה לבדוק דרכון
תזכיר לי היום בשעה שמונה בערב ללכת לאימון
תזכיר לי היום בערב ללכת לאימון
תזכיר לי מחר בבוקר לסדר תיק
תזכיר לי מחר בצהריים לבדוק דוחות
תזכיר לי מחר בערב להתקשר לדני
תזכיר לי היום ב-18:30 ללכת לאימון
תזכיר לי ביום ראשון ב-10 לבדוק דוחות
תזכיר לי ביום שני בשעה 14:00 פגישה
שני הבא ב-14:00 פגישה
תזכיר לי כל יום ב-8 לקחת תיק
תזכיר לי כל בוקר לשתות מים
תזכיר לי כל ערב לבדוק מיילים
תזכיר לי כל יום ראשון ב-9 ישיבת צוות
תזכיר לי כל שבוע ביום ראשון ב-9 לבדוק דוחות
מחר ב-9 תזכיר לי לשלוח חשבונית
כל חודש ב-1 לחודש ב-10 לשלם שכירות
כל שנה ב-1 בינואר לשלוח ברכה
בכל ראשון ורביעי ב-18:00 לרוץ
```

אם נכתב תאריך בלי שעה, ברירת המחדל היא `09:00` בבוקר.

## פקודות בטלגרם

- `/start` - פתיחת הבוט
- `/help` - עזרה ודוגמאות
- `/id` - הצגת ה-Chat ID שלך
- `/list` - כל התזכורות
- `/today` - תזכורות להיום
- `/morning` - סיכום יומי עם היום, איחורים ובוצעו
- `/tomorrow` - תזכורות למחר
- `/week` - תזכורות לשבוע הקרוב
- `/completed` - משימות שכבר בוצעו
- `/week_summary` - סיכום שבועי לפי ימים
- `/recurring` - תזכורות קבועות
- `/overdue` - תזכורות באיחור
- `/search <טקסט>` - חיפוש תזכורות
- `/delete <id>` - ביטול תזכורת
- `/cancel <id>` - ביטול תזכורת
- `/done <id>` - סימון תזכורת כבוצעה
- `/snooze <id> <זמן>` - דחיית תזכורת
- `/clear_done` - ניקוי תזכורות שבוצעו
- `/stats` - סטטיסטיקות

בפקודות `/list`, `/today`, ו-`/week` הבוט מציג תזכורות פעילות בלבד. משימות שבוצעו זמינות דרך `/completed` או הכפתור `בוצעו`.

אפשר גם לדבר טבעי:

```text
מה כל התזכורות שלי?
מה יש לי היום?
מה יש לי מחר?
מה יש לי השבוע?
בוקר טוב
תן לי סיכום יומי
סכם לי את השבוע
מה באיחור?
מה התזכורות הקבועות שלי?
חפש תזכורות על חשבונית
בטל את התזכורת להתקשר לאמא
בטל את 3
סמן כבוצע את החשבונית
דחה את #4 למחר ב-9
אל תשכח לקנות חלב
צריך לדבר עם דני
```

אפשר להוסיף metadata טבעי:

```text
תזכיר לי מחר ב-9 לשלוח מייל קטגוריה עבודה חשוב
תזכיר לי עוד שעה לשתות מים קטגוריה בריאות
תזכיר לי עוד שעה לשלוח חוזה דחוף
```

קטגוריית ברירת מחדל: `כללי`. עדיפות ברירת מחדל: `רגיל`.
אם כותבים משימה בלי זמן, הבוט שואל "מתי להזכיר לך?" ומשלב את התשובה עם המשימה.
תזכורת ליותר מ-6 חודשים קדימה דורשת אישור לפני שמירה.

## מודל סטטוסים

- `pending` - תזכורת שממתינה לשליחה.
- `sending` - התזכורת נתפסה על ידי ה-scheduler ונמצאת בשליחה; נשמר `sending_at`.
- `notified` - תזכורת חד-פעמית נשלחה בטלגרם וממתינה שהמשתמש יסמן `done`, `snooze`, או `cancel`.
- `done` - המשתמש סימן שהתזכורת בוצעה.
- `cancelled` - התזכורת בוטלה.

אם תזכורת נשארת `sending` יותר מ-5 דקות, ה-scheduler מחזיר אותה ל-`pending` וכותב אירוע `send_recovered`.
תזכורות קבועות נשלחות, נרשם אירוע, מחושב `due_at` הבא, והן נשארות `pending`.

## API

אפשר להעביר `chat_id` כ-query param או בגוף הבקשה.

- `GET /health`
- `GET /api/health`
- `GET /api/auth/me`
- `POST /api/telegram/webhook`
- `GET /api/scheduler/run?secret=...`
- `GET /api/debug/sync?chat_id=...`
- `GET /api/stats`
- `GET /api/events`
- `GET /api/reminders?chat_id=...`
- `GET /api/reminders/today?chat_id=...`
- `GET /api/reminders/tomorrow?chat_id=...`
- `GET /api/reminders/week?chat_id=...`
- `GET /api/reminders/recurring?chat_id=...`
- `GET /api/reminders/overdue?chat_id=...`
- `GET /api/reminders/search?chat_id=...&q=...`
- `POST /api/reminders/parse`
- `POST /api/reminders`
- `PATCH /api/reminders/:id/done`
- `PATCH /api/reminders/:id/cancel`
- `PATCH /api/reminders/:id/snooze`
- `PATCH /api/reminders/:id`
- `DELETE /api/reminders/:id?chat_id=...`
- `GET /api/export`
- `POST /api/import`

ה-export כולל תזכורות ו-`reminder_events`, ולא כולל secrets או משתני סביבה.
ה-import מקבל קובץ JSON מה-export או מערך reminders, מייבא תזכורות תקינות בלבד, מחזיר כמה יובאו ואילו פריטים נכשלו, ולא דורס תזכורות קיימות.

בפרודקשן יש שני סוגי גישה ל-API של הדשבורד:

- `API_SECRET` מיועד לגישה חיצונית/סקריפטים דרך header.
- `DASHBOARD_PASSWORD` מגן על הדשבורד. אחרי login, הדפדפן משתמש ב-cookie מסוג HTTP-only כדי לקרוא ל-`/api/reminders`, `/api/stats`, `/api/export`, `/api/import` בלי לחשוף `API_SECRET` ל-JavaScript.

גישה חיצונית ל-API משתמשת ב:

```http
Authorization: Bearer API_SECRET
```

`/api/health` נשאר ציבורי. `/api/telegram/webhook` מוגן על ידי `TELEGRAM_WEBHOOK_SECRET`, ו-`/api/scheduler/run` מוגן על ידי `CRON_SECRET`.

`/api/debug/sync?chat_id=...` מוגן כמו שאר API הדשבורד ומחזיר סיכום בטוח לסנכרון: Chat ID, מספר תזכורות, counts לפי status, חמש תזכורות אחרונות, וסוג DB. הוא לא מחזיר secrets.

ה-webhook שומר `update_id` בטבלת `processed_updates`, כדי ש-retry של Telegram/Vercel לא יעבד את אותה הודעה פעמיים ולא ישלח תגובות כפולות.

## בדיקות איכות

```bash
npm run test
npm run lint
npm run build
```

הבדיקות כוללות parser בעברית עבור זמנים יחסיים, היום/מחר, תאריכים עתידיים, תזכורות קבועות, intentים כמו רשימה/חיפוש/מחיקה, וחישוב המועד הבא לתזכורות קבועות.

## QA Checklist

- שלחו `/id` בטלגרם והכניסו את ה-Chat ID בדשבורד.
- צרו תזכורת בטלגרם וודאו שהיא מופיעה בדשבורד.
- צרו תזכורת בדשבורד וודאו שה-scheduler שולח אותה בטלגרם.
- בדקו done, snooze, cancel גם מטלגרם וגם מהדשבורד.
- בדקו `/week` בלי משימות שבוצעו, ואז `/completed`.
- בדקו `/api/debug/sync?chat_id=...` אחרי login.
- הריצו `npm run test`, `npm run lint`, `npm run build`.

## פתרון תקלות

- אם הבוט לא מתחבר, בדקו ש-`TELEGRAM_BOT_TOKEN` נכון ושקובץ `.env` נמצא תחת `apps/bot`.
- אם אין תזכורות בדשבורד, ודאו שה-API רץ ב-`http://localhost:4000` ושהגדרתם `NEXT_PUBLIC_API_URL`.
- אם זמני התזכורות נראים לא נכונים, ודאו ש-`TZ=Asia/Jerusalem`.
- אם התקנת `better-sqlite3` נכשלת, ודאו שמותקנת גרסת Node.js עדכנית ושהמערכת יכולה לקמפל native modules.
