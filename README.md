# Karthika Damodara Vratham

**A month of offering Love and Devotion** — a free challenge for children ages 6–15 in and around Vizag. October 26–November 25, **2026**, inclusive: **31 calendar days**. All deadlines follow **Asia/Kolkata (IST)**.

## Included features

- Responsive homepage, daily schedule, recognition details, and optional Special Offerings.
- Free parent-assisted registration with age validation and consent.
- Private participant code displayed once, with copy/download actions.
- Daily timestamped lamp photo form: one lamp record per child per day.
- Special Offerings form for artwork, narration, singing or other creativity.
- Private photo/video uploads directly to Supabase, avoiding Vercel function body-size limits.
- Protected `/organizer` page: review photos/videos, verify lamps, mark Gita/Japa/arati attendance by date, shortlist special offerings, replace lost participant codes and export the month’s attendance CSV.
- Parent/privacy information. Children, contact details and media are not publicly listed.

## Deploy to Vercel

Import `sarvajitaramadasa108/karthikadamodaravratham`, choose **main**, **Next.js**, repository root **./**, and Node.js **22.x or newer**. Leave the Output Directory override **off**. `vercel.json` sets `npm ci` and `npm run build`.

The informational website needs no environment variables. Once GitHub is connected, pushes to main trigger production deployments. If a Vercel domain returns `404 NOT_FOUND`, check that the newest commit has a **Ready** production deployment, the domain is assigned to it, and the Git connection/root/framework are correct.

## Enable registrations and uploads

Forms are visible but closed until storage is configured. They do **not** pretend to save data in the browser.

1. Create an organizer-owned **Supabase** project.
2. In its **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql) **once**. It creates the tables and a **private** `offerings` bucket. Do not re-run this initial schema on a populated project.
3. In Vercel → Settings → Environment Variables, set:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service-role key |
| `ORGANIZER_PASSWORD` | A random password, at least 16 characters |
| `SESSION_SECRET` | A separate random secret, at least 32 characters |
| `TEMPLE_NAME` | Optional: actual temple name |
| `SESSION_URL` | Optional: HTTPS meeting link for Gita and Japa |
| `ARATI_URL` | Optional: HTTPS live-arati link |
| `CONTACT_EMAIL` | Recommended: contact for guardian questions, corrections and removal |

Never prefix the key/password/session secret with `NEXT_PUBLIC_`, put them in GitHub, or paste them into chat. Set them for Production (and Preview if desired), then **redeploy**.

4. Register a test participant, save the private code, and check its record in `/organizer`. Remove the test record and any test media before inviting families.
5. Offering submissions open **October 26, 2026** and close after **November 25, 2026**. Do not bypass these date gates on the public website just to test uploads.

## Daily workflow and review

Offer and submit the lamp photo **before 7:30 PM IST**. The photo must visibly include the date/time stamp; a child’s face is not required. The form asks for offering time but **does not automatically verify photo contents or timestamps**. An organizer checks the actual photo before marking it verified.

The server accepts only today’s lamp, rejects claimed offering times of 7:30 PM or later, and rejects future times. Photos arriving after 7:30 PM are explicitly marked late for organizer review of the actual offering time. A lamp submission is **not** session attendance.

- **7:30–7:50 PM:** Bhagavad Gita Values.
- **7:50–8:00 PM:** Japa, one round.
- **8:00 PM onwards:** Live Damodara arati.

Organizers select the date in `/organizer` and mark actual Gita, Japa and arati attendance separately. Month totals show verified lamps and evenings with all three attendance boxes marked. Organizers decide what “regular attendance” means and select final appreciation and prize recipients; no arbitrary attendance threshold is imposed.

## Files and access

- Photos: JPG, PNG, WebP, up to **10 MB**.
- Special Offering videos: MP4, MOV, WebM, up to **50 MB**.
- Files go directly to private Supabase storage via a temporary signed upload URL. Standard Supabase Storage supports browser uploads from the Vercel domain.
- Database tables use RLS with no anonymous/browser policies. Only the server uses the service-role key.
- Only an authenticated organizer can obtain a media review link; it expires in five minutes.
- Participant codes are random and stored as hashes. Anyone with a code can submit for that child, so keep it with the guardian.
- Organizer cookies expire after eight hours. Use a strong password shared only with organizers. For a larger team, replace shared-password access with individual organizer accounts.
- Verify a guardian’s identity before replacing a lost code. Replacement immediately invalidates the old code.
- This version does not send automated email/WhatsApp messages or publish participant media.

## Data maintenance

Set `CONTACT_EMAIL` and agree a retention policy before accepting real registrations. Guardians can request corrections or removal. Use the Supabase dashboard to make these changes. Deleting a participant cascades related database records, **but does not delete storage objects**; remove the participant’s storage folder separately. Periodically review unused upload records and remove files left by abandoned submissions. Supabase backups and storage billing are managed in your account.

## Local development and checks

```sh
npm ci
# Optional: copy .env.example to .env.local and fill server-only values.
npm run dev
npm test
npm run build
```

Use a separate Supabase project for tests involving saved data. Validation tests cover the inclusive dates, IST boundaries, age limits, deadline, file types/sizes and meeting links. A production build checks TypeScript. Real registration/upload persistence needs a configured Supabase project and should be exercised before launch.

The original Damodara illustration was generated for this website. Meeting and live-arati links stay marked as coming soon until supplied.
