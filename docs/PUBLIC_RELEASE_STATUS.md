# Public source verification: 8 September 2026

## Source provenance

The AsifJawad15 web fork was merged with upstream commit
[`000011befda70d0db5cdf68b0519b9b7f6e81e6a`](https://github.com/abdullahshahporan/KUET-CSE-Automation-Web-Portal/commit/000011befda70d0db5cdf68b0519b9b7f6e81e6a),
preserving both histories. GitHub and the fetched Git object confirm that this
commit exists. Leading zeros do not invalidate a Git object ID. Seven upstream
commits were absent from the fork; the merge had no conflicts.

The companion mobile fork incorporated all four missing upstream commits through
[`afea9b6663d4edf89cf3f8395356817e81627acf`](https://github.com/abdullahshahporan/KUET-CSE-Automation-Mobile--App/commit/afea9b6663d4edf89cf3f8395356817e81627acf).
Use the immutable commit links in the accompanying manuscript for the final
fork revisions, which also include these documentation corrections.

## Checks and their limits

The merged web source was checked on Windows with Node 24.19.0:

- ESLint and TypeScript checks passed; the Next.js production build completed.
- Web tests: 24 discovered, **23 passed, 1 database test skipped**, zero failures.
- `check:migrations` failed as intended on the incomplete public SQL set.
  Consequently **`verify:release` cannot pass from this public clone**.
- The TV player passed 10 tests, renderer/Electron type checks, and compilation.
  This is source-build evidence, not a newly signed or packaged Windows installer.
- `reproduce:paper` produced three byte-identical normalized drafts on two runs
  from seven synthetic activities and three rooms, seed 42, node budget 10,000.
  Each draft contains every activity and passes the independent hard-constraint
  validator. Counters: 24 nodes, 0 backtracks, 186 pruned values, 3 attempts.
  Raw penalties are 59, 62, and 80; displayed scores are 41, 38, and 20.
- The normalized output SHA-256 is
  `e148373ba86895467d546603147915ed16772e5d17922157a10d6ea558d7101b`.
  Machine-dependent timing and memory are separate from the normalized output.

The historical upstream report of 24 passes with no skips used separately
supplied SQL. It must not be presented as this public-clone result. The database
test names `profiles`, `students`, `notifications`, `device_push_tokens`,
`geo_attendance_logs`, and `password_recovery_tokens`, but that test did not run
here. No hosted database, Storage policies, device FCM delivery, or campus-scale
performance was verified by these checks.

## Missing installation files

The manifest requires ten academic migrations plus one CMS boundary. Only the
June routine-generator and July TV-hardening migrations are tracked. Missing:

1. `supabase/migrations/20260101000000_baseline.sql`
2. `supabase/migrations/20260905000000_authenticated_boundary.sql`
3. `supabase/migrations/20260905001000_atomic_geo_attendance.sql`
4. `supabase/migrations/20260905002000_booking_and_client_policies.sql`
5. `supabase/migrations/20260905003000_inbox_and_legacy_marks.sql`
6. `supabase/migrations/20260905004000_student_requests.sql`
7. `supabase/migrations/20260905005000_manual_attendance.sql`
8. `supabase/migrations/20260905006000_solver_run_evidence.sql`
9. `database/cms_security_boundary.sql`

Restore the exact originals and validate them against
[`migration-manifest.json`](migration-manifest.json). Do not synthesize new SQL
and label it as the previously evaluated set. The setup guide gives the order
and keeps the separate CMS installation distinct from the academic database.
Historical root-level and `database/` snapshots remain for provenance; they are
not a second supported installation path.

## Permanent archive and DOI

A complete publication capsule and its DOI remain pending. A Git commit, an old
TV installer tag, and a source-only archive are not equivalent to that capsule.
The declared versions are web 0.1.0, TV source 1.1.0, and mobile 1.0.0+1.

To complete the archive:

1. Restore and checksum-verify the nine missing SQL files; include them with both
   exact source revisions, lockfiles, configuration templates, tests, and synthetic
   fixture/output. Exclude real credentials and operational student records.
2. Run `npm run verify:release`, `npm run reproduce:paper`, the TV checks, and the
   mobile workflow with Flutter 3.44.1 / Dart 3.12.1 against that exact capsule.
3. Create a versioned release and archive it through an authorized Zenodo account,
   either by upload or a configured GitHub integration. Record the actual
   version-specific DOI and file checksums after archive publication succeeds.
4. Update the manuscript availability statement and C3 with the verified DOI.

See [Zenodo's software archiving documentation](https://help.zenodo.org/docs/github/).
No DOI has been invented or represented as registered by this update.
