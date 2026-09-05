# Dept Flow development and deployment

SQL migration files added during this review are intentionally Git-ignored and distributed separately. Restore the complete local migration set before database installation or verification. Fresh clones and CI explicitly skip the database test when those files are absent; a passing CI run alone therefore does not verify database policies. Previously tracked migration files remain in Git history.

Use Node 24.19.0 (see `.nvmrc`), npm 10 or newer, and the committed lockfiles. The declared runtime range is Node 22–24. The web and TV packages have separate dependency installations.

```sh
npm ci
npm run verify
npm run reproduce:paper
cd tv-player-app
npm ci
npm test
npm run typecheck
npm run build
```

The tests use an isolated PostgreSQL engine (PGlite) and synthetic data. They do not need production credentials. The web fonts are bundled, including their license, so compilation does not download Google Fonts. Copy `.env.example` to `.env.local` for a running development service and supply your own project configuration. A random `AUTH_SESSION_SECRET` is required even in development; generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and store it privately.

## Database installation

`supabase/migrations/` is the authoritative, ordered migration history for this revision. On a **new, empty local Supabase database**, run `supabase start` followed by `supabase db reset`. This requires the Supabase CLI and Docker; `db reset` replaces the local development database. Alternatively, apply the migration files in filename order to a new isolated Supabase project. The automated database test executes this entire sequence in PGlite.

The `20260101000000_baseline.sql` snapshot includes the academic and TV schema. It defers foreign keys until all referenced tables exist and uses text for the snapshot's formerly unspecified enum types. Older root-level SQL files and `database_schema.sql` are historical references, not additional installation steps. Do not replay the baseline or old permissive-policy scripts over an existing deployment.

For an **existing deployment**, back it up and restore a staging copy first. Compare that copy with the baseline, apply any missing pre-September schema changes, and reconcile the Supabase migration history before applying the September migrations. Check for duplicate attendance keys and resolve their provenance before adding the new unique indexes. Existing unscoped `exam_marks` rows need an administrator to identify their `offering_id`; they remain hidden until that mapping is supplied. This repository deliberately does not guess those associations or delete duplicates. A separate CMS database also needs `database/cms_security_boundary.sql` after its own CMS schema.

Deploy the web API, policies and mobile client together. Old clients that read credentials or perform anonymous writes are intentionally incompatible with these policies. Create the first administrator through a trusted database administration session using a privately generated bcrypt password hash; never ship a shared bootstrap password. Enrolment records, room coordinates and teacher assignments must exist before attendance is opened.

## Authentication and data access

The web issues HMAC-signed, ten-hour sessions. Each protected request checks the current account, role and `session_version`. Password/role/activity changes and logout invalidate sessions. Logout currently invalidates all devices. A mobile biometric prompt unlocks a still-valid session; after expiry the user signs in with a password. Password recovery uses a short-lived, single-use token issued by an administrator at `PUT /api/auth/recovery`, then redeemed at `POST /api/auth/recovery`. Deliver that token privately after verifying the person's identity; no recovery email service is assumed.

Mobile REST requests go through `/api/data/<allowlisted-table>`. The backend converts the validated session into a 30-second database JWT with the user's UUID; PostgreSQL RLS enforces the audience and ownership of nested queries. The database JWT and service-role key never reach the client. Configure `SUPABASE_JWT_SECRET` with a project HS256 signing key that PostgREST actually accepts. Projects that accept only asymmetric signing keys require a signing adapter before using this gateway. See [Supabase signing keys](https://supabase.com/docs/guides/auth/signing-keys).

Custom administrator module restrictions are loaded on each request. Restricted administrators cannot obtain broader CMS access by calling the generic data gateway. Password hashes, recovery tokens and administrative session versions have no client grants. Unknown tables and owner-executed views remain denied until reviewed. The public website reads only deliberately public content; CMS mutations use an authenticated administrative API.

The built-in authentication throttles apply per process. Configure shared rate limits at the ingress for a replicated deployment, trusted proxy handling, TLS, backup restoration and monitoring. Review existing Storage buckets/policies separately: SQL table RLS does not govern stored objects. This revision does not provision storage buckets or publish assets.

## Scheduling, attendance and notifications

Routine generation accepts `options.seed`, `options.maxNodes` and `options.deterministic`. The fixture sets deterministic mode and uses a node budget; interactive requests retain a time limit. Up to five distinct feasible drafts can be returned. Empty domains, exhausted budgets and timeouts do not imply that the requested number of drafts exists.

The eight weighted penalties are student gaps, teacher gaps, daily balance, consecutive periods, morning theory preference, room preference, last period and course day spread. Drafts retain component costs and raw total cost; the displayed score clips `100 - cost` to 0–100. Ranking uses raw cost to avoid ties caused by clipping. Published external slots are occupied constraints. General preservation of manually locked draft activities during regeneration is not implemented. The defaults remain departmental: nine periods, three-period lab blocks, Sunday–Thursday with optional Saturday, A/B cohorts and Asia/Dhaka date handling. Capacity is a warning based on available enrolment counts; unknown lab-group counts are explicit warnings.

Teachers and CRs submit dated room requests for approval. Approval checks serialize on the room and reject overlapping approved reservations. Teachers cannot directly rewrite the published master routine. Student geo-attendance validates the current server session, active enrolment, room/session, server time, optional code and configured coordinates, then writes all attendance representations in one database transaction. Manual mobile attendance also uses a transaction. Client presence monitoring is advisory and cannot change recorded status. GPS and biometrics do not prove physical presence; arrange teacher correction and an accessible alternative for students without compatible devices.

Notification creation inserts an outbox row transactionally. Course recipients come from active enrolments and assigned teachers. Inbox RLS applies before retrieval, including mark-all and unread counts. Private anonymous Realtime subscriptions are not a delivery mechanism: mobile polling and FCM provide updates. FCM and background-device delivery still need testing on configured devices.

FCM service-account credentials and `NOTIFICATION_DISPATCH_KEY` belong only on trusted servers. The edge dispatcher fails closed if its dispatch key is missing. The mobile app never carries this key. Configure a protected scheduler to retry pending outbox records; immediate dispatch alone does not guarantee delivery.

## Reproducibility and release

`npm run reproduce:paper` runs the synthetic fixture twice and verifies byte-identical normalized output. An independent validator checks the activities, periods, teacher/room/cohort collisions, room suitability and occupied slots. `examples/routine/output.json` stores the input, drafts, component penalties and deterministic counters; `environment.json` stores machine-dependent timing, memory and output SHA-256. These small correctness fixtures are not evidence of production scalability or institutional impact.

Before publishing a release, run both repository CI workflows, review the staging migration and multi-role workflows, and record exact commits and lockfiles for web, TV and mobile. Package the fixture, results, setup instructions and tests together with the source. Tags, archive publication and DOI registration are separate release actions and have not been performed here. Manuscript revision is deferred.
