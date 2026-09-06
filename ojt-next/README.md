# OJT Attendance — Next.js / Vercel port

A port of the PHP+MySQL+XAMPP version to Next.js 14 (App Router) +
Postgres, deployable to Vercel. Live-tested end-to-end against a real
Postgres instance during development — see "What's tested" below.

## Quick reference — your links

These aren't fixed URLs I can hand you — they depend on your own
local setup and your own Vercel/Neon account, which nothing here has
access to. Here's exactly where each one comes from:

| | Local (`npm run dev`) | On Vercel (after deploying) |
|---|---|---|
| **Admin panel** | `http://localhost:3000/aclc-staff-9f2k7q` | `https://<your-project-name>.vercel.app/aclc-staff-9f2k7q` — `<your-project-name>` is whatever you name the project when you import it in Vercel (shown at the top of the deployment dashboard, and in the URL Vercel gives you after the first deploy) |
| **Database console** | Whatever you use locally — `psql`, or pgAdmin's Servers panel (`localhost:5432`, database `ojt_attendance`) | Vercel project → **Storage** tab → click your database → **Open in Neon** (or your provider's dashboard link) — this takes you to the Neon Console's SQL Editor / connection details for that specific database |
| **Student portal** | `http://localhost:3000/student-login` | `https://<your-project-name>.vercel.app/student-login` |

**Two things worth remembering:**
- The admin URL (`aclc-staff-9f2k7q`) isn't linked anywhere in the UI on purpose — bookmark it. Rename the folder in the project if you want a different slug (see "Deploying to Vercel" below for how to update every reference).
- Vercel assigns your project's `.vercel.app` domain automatically the first time you deploy — check the Vercel dashboard's project overview page, or attach a custom domain there if you have one.

## What changed from the PHP version (and why)

- **Sessions:** the PHP version stored session tokens in
  `admin_sessions`/`student_sessions` DB tables and sent them as
  `X-Admin-Token`/`X-Student-Token` headers. This version uses signed
  **httpOnly JWT cookies** instead (`lib/auth.ts`) — no DB round-trip
  per request, no token sitting in `sessionStorage` where JS/XSS
  could read it, and it's the natural fit for Vercel's stateless
  serverless functions. The browser sends cookies automatically, so
  there's no client-side token plumbing at all.
- **Database:** MySQL → Postgres (`sql/schema.sql`), since that's
  what Vercel's own Postgres integration and most Vercel-friendly
  providers (Neon, Supabase) speak. Same tables, same columns,
  same business rules.
- **No ORM:** uses `pg` directly rather than Prisma. Prisma's engine
  binary download was blocked in the sandbox this was built in, and
  `pg` has no native binary at all — faster cold starts on serverless,
  and it works on Vercel's Edge Runtime if you ever want that.
- **DTR download:** simpler than the PHP version. Since it's an
  httpOnly cookie now, hitting `/api/dtr` from a same-origin `<a>`
  tag just works — no need for the PHP version's
  `?token=...`-in-the-URL workaround.
- **Face recognition / QR scanning:** unchanged in approach —
  still face-api.js + jsQR running entirely in the browser
  (`app/scanner/scanner-client.tsx`, `app/enroll/enroll-client.tsx`),
  loaded from CDN exactly like the PHP version. Ported logic
  line-for-line, including the 15-second debounce and 20-capture
  averaged enrollment.

## Bugs found and fixed in a later debugging pass

- **CRITICAL — session-type confusion allowed a full admin bypass.**
  `getAdminSession()`/`getStudentSession()` (`lib/auth.ts`) verified a
  JWT's *signature* but never checked its `kind` claim actually said
  `"admin"` or `"student"`. Since both session types are signed with
  the same secret, a student's own legitimately-issued token — copied
  into a cookie literally named `admin_session` — passed
  `requireAdmin()` and granted full admin access: settings changes,
  roster edits, document upload/delete, power status, face-encoding
  enrollment, all of it. httpOnly blocks a page's own JavaScript from
  reading/writing cookies, but a browser's DevTools cookie editor can
  still view and set them directly, so this was exploitable by any
  student who opened DevTools — no special tooling needed. **Confirmed
  exploitable live**: logged in as a student, forged their token into
  an `admin_session` cookie via curl, successfully called
  `PUT /api/settings` and changed a real value. Fixed by checking
  `claims.kind` matches the expected session type before trusting it;
  re-tested the same attack afterward (blocked) in both directions
  (student token as admin, admin token as student), and confirmed
  legitimate admin/student logins still work normally.
- **DATE columns silently off by a day** (real, confirmed via testing
  under `TZ=Asia/Manila`): `pg` parses Postgres `DATE` into a JS
  `Date` at *local* midnight — no timezone is attached to a bare
  DATE, so `pg` has to guess. Calling `.toISOString()` on that (or
  passing it through `JSON.stringify`, which does the same
  internally) converts to UTC and rolls the date back a day in any
  timezone ahead of UTC — which includes the Philippines. Verified
  live: `2026-09-04` became `2026-09-03T16:00:00.000Z`. Fixed at the
  source in `lib/db.ts` by overriding `pg`'s type parser for DATE
  (OID 1082) to return the raw `"YYYY-MM-DD"` string instead of a
  `Date` object — every date field in the app is a plain string now,
  end to end. This affected attendance dates, DTR dates, and
  `ojt_start_date` everywhere they were displayed.
- **Admin roster detail panel would crash on click**: `ojt_start_date`
  was passed from `app/admin/page.tsx` straight through as a raw `Date`
  object to the client component, then `fmtDate()` called `.replace()`
  on it expecting a string — same root cause as the DATE bug above,
  caught before the type-parser fix made it moot.
- **Camera left running after navigating away** from `/scanner` or
  `/enroll`: both pages' cleanup functions stopped the detection
  loop/timer but never called `.stop()` on the actual
  `MediaStream` tracks, so the camera (and its indicator light)
  stayed active until the tab closed. Fixed by storing the stream in
  a ref and stopping its tracks in the effect's cleanup.
- **Enrollment capture had no concurrency guard**: `scanner-client.tsx`
  already guarded against overlapping async face-detection calls
  (`busyRef`), but `enroll-client.tsx`'s capture loop didn't. On
  slower hardware where detection takes longer than the 500ms tick,
  this could cause multiple in-flight detections to each
  independently push a capture and each independently trigger the
  save once the target was hit — redundant POSTs to
  `/api/face-encodings`. Fixed with the same busy-flag pattern.

## What's tested (live, against real Postgres + `next start`)

- Student registration, including race-safe sequential student-ID
  generation (`BSIT-0001`, `BSIT-0002`, ...), duplicate-email
  rejection, password validation
- Student login/logout, cookie-based session, `/student` page
  server-side redirect when not logged in
- Admin login/logout, `/admin` page server-side redirect when not
  logged in, roster endpoint
- **`/api/scanner-sync`** — the real business logic: time-window
  enforcement, method validation (TIME_IN must be FACE, TIME_OUT
  must be QR), duplicate-scan rejection, TIME_OUT-without-TIME_IN
  rejection
- DTR generation with real attendance data — correct hours, correct
  auth gating (401 without a session)
- Face-encoding enroll (POST) and fetch (GET), with admin auth
  gating verified both ways
- `/scanner` and `/enroll` pages redirect when not admin-logged-in,
  load when logged in
- **Settings tab** — GET/PUT round-trip verified (changed default
  hours from 486.00 to 500.00, confirmed it persisted)
- **Attendance access control** — tightened vs. the PHP version's
  public-by-student_id lookup. Tested the full matrix: no
  session → 403, admin session → allowed for any student, a
  student's own session → allowed, a student session against
  *another* student's ID → 403
- **Resources (documents) auth** — public GET list, upload/delete
  correctly require admin (401/403 without it)
- `npm run build` completes cleanly, zero TypeScript errors
- Caught and fixed one real bug in this pass: `pg` returns
  `timestamptz` columns as JS `Date` objects, and passing those
  directly as React Server Component props kept them as `Date`
  instances rather than strings — broke `fmtTime()`'s string
  handling on the student dashboard. Fixed by serializing to ISO
  strings in the server component before handing off to the client
  component.

**Not testable in a sandbox, needs your hardware:** actual camera
access and face-matching accuracy — same limitation the PHP version
had. **Not testable in a sandbox, needs a real Vercel Blob token:**
the actual resource file upload — `blob.vercel-storage.com` isn't
reachable from a sandboxed environment. The route code is correct
against the documented `@vercel/blob` API, but I haven't been able
to exercise a real upload; test this first thing once deployed.

## What's NOT ported yet

- **`attendance.php?student_id=X` gap — closed, not carried over.**
  The PHP version left this public by design; here it requires
  either an admin session or the matching student's own session
  (see "What's tested" above).
- Nothing else major — Settings and Documents (resources) are now
  wired up on both the admin and student sides.

## Local setup

```bash
npm install
cp .env.example .env       # fill in DATABASE_URL + JWT_SECRET
```

Point `DATABASE_URL` at a local Postgres (or any hosted one) and run:
```bash
psql "$DATABASE_URL" -f sql/schema.sql
```

Set the admin password (same "CLI only, never a public endpoint"
approach as the PHP version):
```bash
node -e '
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const hash = await bcrypt.hash("YOUR_REAL_PASSWORD", 10);
  await pool.query("UPDATE admin SET password_hash = $1 WHERE username = $2", [hash, "superadmin"]);
  console.log("Password set.");
  await pool.end();
})();
'
```

```bash
npm run dev
```
Visit `http://localhost:3000`. Admin: `http://localhost:3000/aclc-staff-9f2k7q`
(same unlisted slug as the PHP version, for continuity — rename the
folder if you want a different one).

## Deploying to Vercel

**Note on "Vercel Postgres":** the standalone product by that name was
discontinued — Vercel migrated it into a Marketplace integration with
Neon (completed by early 2025). What's below reflects the current setup.

1. **Database:** in your Vercel project → **Storage** tab → **Create
   Database** → choose the **Neon** integration (or Supabase, or any
   other Postgres option in the Marketplace — they all work the same
   way for this app). This provisions the database and automatically
   injects `DATABASE_URL` into your project's environment variables.
   Then run `sql/schema.sql` against it — either through the Neon
   Console's SQL Editor (or your chosen provider's equivalent), or
   from your machine with `psql "$DATABASE_URL" -f sql/schema.sql`.
2. **File storage:** attach [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
   the same way (Storage tab → Create → Blob). This automatically sets
   `BLOB_READ_WRITE_TOKEN` for you — the documents upload feature
   (`/api/resources`) needs it.
3. **Push this project to a GitHub repo**, then import it in Vercel
   ("Add New Project").
4. **Environment variables** (Vercel project settings — Storage
   integrations set these two automatically, just double check they're
   there):
   - `DATABASE_URL` — set automatically by step 1
   - `BLOB_READ_WRITE_TOKEN` — set automatically by step 2
   - `JWT_SECRET` — **not automatic, add this one yourself**: a long
     random string (`openssl rand -base64 32`)
5. **Set the admin password** — same CLI snippet as above, run from
   your own machine pointed at the production `DATABASE_URL` (Vercel's
   Storage tab has a "Copy snippet"/.env-pull option to get this value
   onto your machine without retyping it).
6. Deploy. Vercel builds and serves automatically on every push.

## Project layout

```
app/
├── page.tsx                  # Landing (server component, checks cookie)
├── landing-client.tsx
├── student-login/page.tsx    # Login + register tabs
├── student/                  # Auth-gated dashboard + DTR download
├── aclc-staff-9f2k7q/page.tsx  # Admin login (unlisted URL)
├── admin/                    # Auth-gated dashboard (students/attendance/scanner tabs)
├── scanner/                  # Live face+QR scanner (browser-side)
├── enroll/                   # Face registration (20-capture average)
├── api/                      # Route handlers — one per PHP endpoint
└── globals.css                # Ported as-is from the PHP version's branding
lib/
├── db.ts        # pg Pool singleton
├── auth.ts      # JWT cookie session helpers
├── api-helpers.ts
├── student-id.ts   # Course-initials/sequencing logic, ported
└── client-helpers.ts  # fmtDate/fmtTime/etc., ported from api.js
sql/schema.sql   # Postgres schema (consolidates schema.sql + both migrations)
```
