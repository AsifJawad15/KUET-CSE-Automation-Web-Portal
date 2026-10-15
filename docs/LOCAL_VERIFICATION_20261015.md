# Local verification findings - 15 October 2026

The local portal/API and companion clients were checked against the existing hosted academic and CMS databases. The backend ran locally on port 3001; isolated PostgreSQL transaction tests used localhost. This is not a production deployment or a claim that every feature works.

## Provenance and successful checks

The full web checkout tested was commit `58655f099bbbee320c512f3b1364f43bd2dbe239`, with its reconstructed SQL package. Its `src`, `shared`, and `tv-player-app` files match the source implementation in this PR; installation/package files differ. Do not treat its full database results as source-only CI results.

- Web lint, TypeScript checks, production build and 43 standard tests passed. Standard tests were run sequentially after the parallel invocation exhausted host memory.
- Seven isolated real PostgreSQL transaction tests passed; the local SQL manifest verified 12 academic migrations and two CMS files.
- Academic service access, CMS service access and authenticated database JWT access returned HTTP 200.
- Administrator session, teachers, students, courses, rooms, offerings and timetable reads succeeded through the local API. Private credential columns and unauthorized role access were rejected.
- TV tests: 10 passed; renderer/Electron type checks and builds passed. The local schema-v2 TV snapshot returned content and schedules with Asia/Dhaka timezone and no section errors. Native TV windows, monitor mapping and offline recovery were not verified end-to-end.

## Unresolved attendance/database issue

Temporary teacher and student accounts with an isolated offering and active enrolment both authenticated successfully. The teacher's manual attendance request returned HTTP 400, and no attendance record persisted. A transaction-scoped direct reproduction identified PostgreSQL error `42804`:

```text
column "status" is of type attendance_status but expression is of type text
```

The existing `record_teacher_attendance` function inserts `entry.value` from `jsonb_each_text` directly into the enum column. A compatible validated cast/conversion and regression coverage against the existing enum schema are required. The synthetic baseline's text schema does not expose this incompatibility. No database schema repair was applied during verification.

The mobile service audit also reproduced a missing timetable class: the client filters course-code digits instead of the stored offering term. The mobile AI client omits the bearer token required by the assistant API. An authenticated teacher assistant request succeeds; the matching request without a bearer token returns 401. These are follow-up defects, not fixes delivered by this PR.

## Test cleanup and limits

Temporary accounts and all seeded academic records were removed and their specific IDs verified absent. Database counts returned to their initial values. No real passwords were reset and no announcements were sent to real users. Credentials, raw device logs, private fixture data and local environment files are excluded from this document and commit.

Android reached sign-in, but missing-font exceptions and emulator system/app ANRs prevented complete UI acceptance. Physical-device GPS/biometrics, FCM delivery, recovery flows, and the complete booking/CR lifecycle remain unverified. Companion results/grading/resource screens still contain documented demonstration or incomplete actions.
