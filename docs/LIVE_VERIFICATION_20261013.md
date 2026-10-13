# Live database and portal verification - October 13, 2026

The academic Supabase project `idsehnlpjmdvfqiobfea` and CMS project `jabzmmmjafuqynjyhkrv` were ACTIVE_HEALTHY. The signed-in portal at `http://localhost:3000/dashboard` was reviewed against the live academic database.

## Changes and database checks

- Merged upstream `ca904058a35934592a5e03d5dbc18908568bf3e2`, retaining its CMS key, authentication, faculty and TV registry fixes.
- Added `20261013063223_routine_enum_role_compatibility.sql`. Existing production accounts use a `user_role` enum; reconstructed local installations use text. The RPC accepts either and the existing server role receives usage of the private schema.
- After the user's explicit approval, applied the October atomic timetable SQL and role compatibility together as hosted migration `atomic_routine_operations_enum_compatible` (version `20261013063944`), then applied `routine_service_schema_usage`. These are additive upgrades to the inspected existing schema; the baseline and historical scripts were not replayed.
- Verified the revision table, 20 revision triggers, conflict trigger and enum-compatible commit function. Anonymous and ordinary authenticated roles cannot execute the commit RPC; `service_role` can.
- Exercised the real RPC under `SET LOCAL ROLE service_role` with a current administrator and an invalid draft inside a rolled-back transaction. It reached the expected `Complete draft state required` rejection, confirming the enum and private schema access work. No timetable was published or edited by this check.
- Record counts remained 54 teachers, 19 students, 64 courses, 10 rooms and 42 published routine rows.
- Hosted migration history already differed from the reconstructed local history. Do not run a blanket `db push` or mark the historical baseline as applied without comparing schemas. The hosted names above document the reviewed upgrade.

## Page review and fixes

| Page | Result |
| --- | --- |
| Faculty Info | Teacher cards load with names, designations, IDs and activity/leave status. |
| Student Management | All eight term cards load; counts total 19. The populated 4-1 cohort opens six student records. |
| Course Info | 64 courses load: 41 theory, 23 lab/sessional, 147 credits. |
| Room Info | 10 room cards load: five classrooms, five labs, two with location information. |
| Published Class Routine | Grid, periods, breaks, combined classes and slot detail popup render. Fixed the API's ignored session filter and course-code-derived term filter: it now uses the actual offering session and term. The selected 2023-2024 / 3-2 / A timetable shows 16 grouped entries after the fix. |

Timetable service failures now propagate to the page's error message instead of becoming a misleading empty timetable. Only the most recent filter request can update the grid, preventing an older response from overwriting a newer selection. The three timetable source files were also synchronized to the running local release checkout, and the browser was reloaded for verification.

## Information requiring administrator review

- Nine student records lack sections. Names, roll numbers, terms and sessions are present.
- Eight rooms lack latitude/longitude. All room types and positive capacities are present; location-based attendance needs the missing coordinates.
- Fifty teacher records have missing, blank or placeholder `0000000000` phone numbers. Two teacher records use test/placeholder names. Some imported names also appear to duplicate faculty under different IDs; confirm identities before merging records.
- Existing Section A entries for CSE 3218 and CSE 3230 overlap on Sunday 10:40-13:10 and Monday 14:30-17:00 in session 2025-2026, offering term 3-1. Rooms and teachers differ, but both records target the same cohort without group information. Confirm lab groups or reschedule them. Their course codes suggest 3-2, which also requires checking the stored offering term; the API no longer guesses that term.
- One published row uses section `A2`; the weekly page exposes A/B selectors. Confirm whether this represents a lab group and map it appropriately before claiming the parent-section timetable is complete.
- Existing routine rows have valid time intervals and resolve to courses, teachers and rooms. There are no routine version records for the existing legacy publication. Its historical publication provenance cannot be reconstructed automatically.

## Validation and deployment limits

`npm run verify:release` passed lint, TypeScript, all 43 ordinary runner cases, production build and all seven real PostgreSQL runner cases, with no skipped cases. Four new display/service regressions cover weekly session/term filtering, unfiltered consumers, dated filtering and surfaced API errors. The PostgreSQL enum check also removes the private schema grant first, reapplies compatibility, and tests the function as `service_role`. Twelve academic migrations and two CMS files pass the checksum manifest. Logs are stored at `docs/evidence/live/web-release.log`.

The Supabase security advisor reports the existing 20 mutable function search paths, `btree_gist` in public and disabled leaked-password protection; 13 RLS-enabled tables have no client policy, including intentionally server-only tables. No public academic table lacks RLS. The new routine functions have fixed search paths and restricted RPC grants. Existing warnings were not silently treated as resolved. See [function search path remediation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [extension remediation](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

The local browser recorded a Next.js smooth-scroll warning and browser message-channel errors; the latter do not establish an application defect. The reviewed lists and timetable loaded successfully.

The public URL `https://kuet-cse-automation-web-portal.vercel.app/` returned HTTP 200 through a direct network request, but Chrome reported `ERR_CONNECTION_TIMED_OUT`. Its live UI and deployed commit were not verified. The connected Vercel account has no accessible portal project (project lookup returns 404), so this session did not update that Vercel deployment. Deploy the final GitHub commit through the owning Vercel project before claiming public-page acceptance.
