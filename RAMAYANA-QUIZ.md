# Ramayana quiz

This independent feature adds only new files. The existing Karthika pages, quiz API, components, tables, dependencies and environment settings are unchanged.

## Setup

The supplied 25-question PDF is now transcribed in `lib/ramayana/question-bank.json`, preserving the English questions, option order and supplied answer key while cleaning Telugu extraction artifacts. The answer bank is returned only to authenticated admins. In the creation form, **Load your 25 PDF questions** fills the draft for review before creating a room.

To set up the tables and import this specific quiz in one step, run **`supabase/seeds/ramayana-pdf-25-setup.sql`** in the existing project's Supabase SQL Editor. It adds the Ramayana schema only when absent, creates the 25-question room, and returns its actual code. Re-running it reuses an identical imported room without clearing attempts. It does not change Karthika tables. This file is prepared locally; it has not been executed against your live project. It can be regenerated with `node scripts/ramayana-prepare-pdf-seed.mjs`.

1. In the **same Supabase project** used by this website, run `supabase/migrations/20261020_ramayana_quiz.sql` once in SQL Editor. It creates only `ramayana_*` tables and functions. It never alters the original quiz or challenge tables.
2. Existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are reused. Host login uses the requested password **`admin123`**, set directly in the separate Ramayana server code. No password environment variable or new dependency installation is needed. The cookie signature derives from the existing server-only storage key, independently of the login password.
3. Deploy this website with those additions, or run `npm run dev` locally. Deployment/database setup are not performed by adding these files.
4. Open `/ramayana/host`, sign in, and create a quiz manually or import an Excel workbook. Up to 100 questions; all questions have a 30-second timer. Use the supplied template and replace its placeholder question. English and Telugu can appear together in each question/option. Imported workbooks require four filled option columns.
5. Select the room, click **Open audience screen**, and show that separate tab on the projector. It displays only the QR code and participation count, without participant names or numbers. The QR opens `/ramayana/join?code=123456` on the same domain. Use the deployed public HTTPS domain for real phones; a localhost QR will not work on another device. Keep the admin dashboard on your private screen.
6. Participants enter their name and mobile number. Registration closes when the admin clicks **Start quiz for everyone**.

## Participant timing

The waiting page checks for admin start every second. Each person's first three-second countdown begins when their browser first observes the start. After that, the database stores their own question opening time and deadline. The current question becomes available after the countdown. Submitting a selected answer locks that answer, then immediately starts the next three-second countdown. Other participants are unaffected.

At 30 seconds, the answer is recorded as unanswered and the next countdown starts on the next server contact. A disconnected participant's current timer keeps running; reconnecting records that timeout and starts the next question. Future questions are not consumed while the browser is disconnected. Refreshing resumes the same attempt in the same browser. Polling/network delays can briefly extend a transition on screen; they never extend the server's answer window. A late submission is treated as a timeout.

Correct answers earn one point. Results sort by correct answers descending and cumulative answer time ascending, with join time as a stable final ordering. Time excludes countdowns and includes 30 seconds for each timeout. The participant sees their final score; the admin sees names, numbers, progress, scores and time and can export an Excel workbook. Compare completed attempts for final standings. **Close quiz** stops unfinished attempts; create a new room for another round. There is no automatic SMS or phone verification.

## Isolation and privacy

Routes: `/ramayana`, `/ramayana/join`, `/ramayana/host`, `/ramayana/screen`, `/api/ramayana`, `/api/ramayana/qr`. New code is in `components/ramayana` and `lib/ramayana`; CSS is scoped with CSS modules. The admin cookie is separate from the Karthika organizer cookie. A browser-stored random participant token is hashed in the database and authenticates the attempt; phone numbers are never returned by participant APIs or embedded in QR codes. Only admin requests can list participants. Keep the original browser/storage to resume an attempt; the same number cannot register twice in one room. There is no self-service recovery on another device.

The QR generator is vendored with its MIT license, avoiding changes to the existing package files and external QR services. Nothing sends participant data to a QR provider. Follow your event's consent/retention practices; participants see a notice explaining who receives their details. The independent signed admin cookie expires after eight hours. The original organizer authentication code is unchanged.

## Verification

- `npm run typecheck`
- `npx tsx --test tests/ramayana.test.ts`
- `npm run build`
- For isolated PostgreSQL checks, install `@electric-sql/pglite` in a **temporary folder**, then run `node scripts/ramayana-db-test.mjs <absolute-temporary-folder>`. This never connects to or changes Supabase. It exercises independent progress, countdowns, refresh, timeouts, duplicate submissions, scoring, completion, late registration and public access denial.

Before a public event, test with two physical phones against the deployed Supabase-backed site and confirm the expected attendance size. The implementation polls the server; production capacity depends on hosting/database limits and has not been load-tested.
