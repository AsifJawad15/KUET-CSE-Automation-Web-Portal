# Follow-up verification: 5 September 2026

This records local work against `DeptFlow_Revision_Verification_Review.md`.
The review checked public documentation and explicitly did not audit all routes.
Its “resolved” labels are not an independent security certification.

## What changed

- Removed the blanket README assertion that all sensitive tables have verified RLS.
- Kept the accurate statement that no enforced CSP is claimed. `next.config.ts`
  has other response headers, but no Content-Security-Policy header.
- Documented test, type-check, fixture, and release-verification commands in the
  README Testing section. Node 22-24 (tested 24.19.0) was already corrected locally.
- Distinguished TV source 1.1.0 from the historical 1.0.0 Windows installer.
  The old tag is not moved or relabeled to claim it contains the newer source.
- Updated the remaining README repository links, draft-lock wording, and private
  notification update description. Cookie settings are no longer called a full
  CSRF defense.
- Listed the ten authoritative academic migrations in SETUP.md. The separate CMS
  boundary follows the existing CMS schema in the CMS project. Historical SQL
  snapshots are not an alternative installation path for this revision.
- Added `migration-manifest.json` with filenames and LF-normalized SHA-256 hashes.
  `npm run check:migrations` rejects missing, additional, or modified academic SQL
  and requires the separate CMS boundary. `npm run verify:release` runs this check
  before lint, type checks, tests, and production compilation.

## Route inspection and tested scope

| Route or component | What was inspected or tested |
|---|---|
| `src/lib/serverAuth.ts` | Signature and expiry validation, current profile role/active state/session version, administrator permissions, and requested role restrictions. Existing tests cover token failures and revocation. |
| `teacher-portal/marks` | Both handlers require teacher/head. `teachingScope` filters an active offering by the session user's teacher ID and loads active enrolments. POST rejects a course or student outside that scope; GET filters by offering and enrolled rolls. |
| `teacher-portal/geo-attendance` | Handlers require teacher/head, derive teacher identity from the session, and check assigned offering or owned room. |
| `geo-room-locations` | All handlers require admin/head before resource queries. |
| `student/geo-attendance` | Both handlers require student. POST passes `auth.user.id` to the attendance transaction rather than a submitted student ID. GET filters offerings by active enrolment. |

The unauthenticated-handler tests cover all exported GET/POST/PATCH/DELETE
handlers in the named routes. Added checks verify that a valid student session
gets 403 on the marks, teacher geo-attendance, and room-location handlers.
This is not a complete test matrix for every authenticated cross-resource case.

The isolated PGlite database test explicitly checks `relrowsecurity` for
`profiles`, `students`, `notifications`, `device_push_tokens`,
`geo_attendance_logs`, and `password_recovery_tokens`. It tests denied anonymous
reads of those tables, private inbox visibility, forbidden password-column access,
and token ownership. Other checks cover attendance rollback, bookings, session
revocation, and outbox creation. This does not certify all tables, Storage policies,
hosted grants, or production deployment behavior.

## Executed verification

`npm run verify:release` passed locally: the full SQL manifest matched, lint and
TypeScript passed, all 24 tests passed with zero skips, and the production build
completed. The database test installs the migration sequence in a new isolated
PGlite instance. This is not a clean hosted Supabase reset or a public-clone test.
An isolated copy of the preflight also rejected a missing SQL set, accepted the
complete set, and rejected a deliberately modified SQL file. No production or
source migration was modified for those checks.
Earlier TV and Flutter test/build evidence is unchanged; those clients were not
modified in this follow-up.

## Release requirements

The Git-ignored SQL set is distributed separately. Include the matching schema,
migrations, configuration templates, tests, and fixture in any installation
archive. Verify the manifest and run `npm run verify:release` against that exact
archive before release. A source-only GitHub download currently omits required
SQL and cannot provide complete database verification.

Run the TV and mobile checks in their own packages and record the final source
revisions and artifact checksums. Verify the hosted configuration and workflows
in staging before deploying a coordinated server, policy, and client update.
Local PGlite tests do not verify production records, Storage policies, real-device
push delivery, or every route's authenticated cross-resource behavior.

The TV source version is 1.1.0; the historical 1.0.0 installer is a different
artifact. Optimized Android testing APKs use debug signing. A production Android
release requires a registered application ID, matching Firebase registration,
and a private signing key. Do not use a debug key for a store release.
