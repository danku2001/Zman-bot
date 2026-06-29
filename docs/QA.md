# ZmanBot v1.0 QA Checklist

רשימת בדיקה ידנית לפני פריסה או release.

## הכנה

- [ ] להריץ `npm install`.
- [ ] ליצור `apps/bot/.env` מתוך `apps/bot/.env.example`.
- [ ] לוודא ש-`TELEGRAM_BOT_TOKEN` מוגדר רק ב-`.env` או בסביבת השרת.
- [ ] ליצור `apps/web/.env` מתוך `apps/web/.env.example`.
- [ ] לא להגדיר `NEXT_PUBLIC_API_SECRET`. הדשבורד משתמש ב-cookie מאובטח אחרי login, ו-`API_SECRET` נשאר רק בצד השרת/סקריפטים חיצוניים.
- [ ] להריץ `npm run dev`.
- [ ] לבדוק ש-`GET /health` מחזיר תשובה תקינה.

## Telegram Commands

- [ ] `/start` מחזיר הודעת פתיחה.
- [ ] `/help` מציג דוגמאות ופקודות.
- [ ] `/id` מציג Chat ID נכון.
- [ ] `/list` מציג את כל התזכורות.
- [ ] `/today` מציג תזכורות להיום.
- [ ] `/week` מציג תזכורות לשבוע.
- [ ] `/recurring` מציג תזכורות קבועות.
- [ ] `/overdue` מציג רק תזכורות `pending` שעבר זמנן.
- [ ] `/search חשבונית` מחזיר תוצאות רלוונטיות.
- [ ] `/stats` מציג ספירות ללא שגיאה.

## Creating Reminders

- [ ] לשלוח `תזכיר לי עוד דקה לבדוק` ולוודא שנוצרת תזכורת.
- [ ] לשלוח `תזכיר לי מחר ב-9 לשלוח מייל`.
- [ ] לשלוח `מחר ב-9 תזכיר לי לשלוח מייל`.
- [ ] לשלוח `תזכיר לי היום בערב ללכת לאימון`.
- [ ] לשלוח `שני הבא ב-14:00 פגישה`.
- [ ] לשלוח `תזכיר לי כל יום ב-8 לשתות מים`.
- [ ] לשלוח `תזכיר לי כל שבוע ביום ראשון ב-9 לבדוק דוחות`.
- [ ] לוודא שתזכורת ללא זמן מפעילה שאלת המשך.

## Status Lifecycle

- [ ] תזכורת חדשה מופיעה כ-`pending`.
- [ ] בזמן השליחה היא עוברת ל-`sending`.
- [ ] אחרי שליחה חד-פעמית היא מופיעה כ-`notified`, לא `done`.
- [ ] כפתור `בוצע` משנה `notified` ל-`done`.
- [ ] כפתור `דחה` משנה `notified` ל-`pending` עם `due_at` חדש.
- [ ] כפתור `בטל` משנה `pending`, `sending`, `notified`, או `done` ל-`cancelled`.
- [ ] תזכורת קבועה נשלחת, מקבלת `due_at` הבא, ונשארת `pending`.

## Text Actions

- [ ] `בטל את #ID` מבטל תזכורת לפי ID.
- [ ] `בטל את התזכורת חשבונית` מבטל לפי טקסט חלקי.
- [ ] `סמן כבוצע את #ID` מסמן כבוצע לפי ID.
- [ ] `סיימתי את חשבונית` מסמן כבוצע לפי טקסט חלקי.
- [ ] `דחה את #ID למחר ב-9` דוחה תזכורת.

## Dashboard

- [ ] Home מציג active, today, week, overdue, recurring, notified, done, cancelled.
- [ ] Recent activity נטען ללא שגיאה.
- [ ] All reminders נטען ומציג תזכורות.
- [ ] Today, Tomorrow, Week, Overdue, Recurring, Done, Cancelled נטענים.
- [ ] Search מחפש תזכורות.
- [ ] בכל רשימה חיפוש מקומי עובד.
- [ ] פילטר status עובד כולל `notified`.
- [ ] פילטר category עובד.
- [ ] פילטר priority עובד.
- [ ] מיון לפי due date עובד לשני הכיוונים.
- [ ] Mark done עובד.
- [ ] Snooze עובד.
- [ ] Cancel עובד.
- [ ] Delete מהדשבורד מוחק מהרשימה ושומר אירוע audit.
- [ ] Empty state ברור כאשר אין תוצאות.
- [ ] Loading/error states נראים תקינים.
- [ ] המסך קריא במובייל וב-RTL.

## Import / Export

- [ ] Export מוריד JSON.
- [ ] ה-JSON כולל `reminders` ו-`events`.
- [ ] ה-JSON לא כולל `.env`, `TELEGRAM_BOT_TOKEN`, `API_SECRET`, או סודות.
- [ ] Import של קובץ export עובד.
- [ ] Import עם פריטים לא תקינים מציג כמה נכשלו.
- [ ] Import לא דורס תזכורות קיימות.

## Restart Survival

- [ ] ליצור תזכורת.
- [ ] לעצור ולהפעיל מחדש את הבוט.
- [ ] לוודא שהתזכורת עדיין קיימת.
- [ ] לוודא שתזכורת `sending` ישנה חוזרת ל-`pending` ונרשם `send_recovered`.

## Public Repo Safety

- [ ] `.env` מוחרג.
- [ ] `node_modules` מוחרג.
- [ ] `.next` מוחרג.
- [ ] `dist` מוחרג.
- [ ] `data/*.db` מוחרג.
- [ ] logs מוחרגים.
- [ ] `.DS_Store` מוחרג.
- [ ] אין טוקן אמיתי בקבצים שעולים ל-Git.
- [ ] `SECURITY.md` מסביר רוטציה של Telegram token.
- [ ] README כולל `Before Pushing To GitHub`.

## Final Commands

- [ ] `npm run test`
- [ ] `npm run lint`
- [ ] `npm run build`
