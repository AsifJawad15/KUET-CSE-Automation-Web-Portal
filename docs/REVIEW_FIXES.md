# Software review work — 5 September 2026

The user confirmed that both Supabase projects accepted their respective migrations. The new SQL files remain local and Git-ignored at the user's request. Fresh-clone CI skips database verification until that private migration set is supplied. Hosted application workflows have not been independently verified by this agent.

This tracks software changes against `DeptFlow_SoftwareX_PreSubmission_Review.pdf`. It is a technical work record, not a revision of the manuscript or a production security certification.

| Review area | Implemented change | Local evidence |
|---|---|---|
| Public credential access | Removed mobile fallback/password-hash operations; server password/recovery endpoints; required development secret | Token, missing-session, role and revocation tests; password column denied by PostgreSQL |
| Mobile session storage | Secure bearer storage; removes legacy preferences and saved biometric password; biometric session validation | Flutter gateway and logout tests |
| Route authorization | Teacher ownership and enrolment checks, protected parsers/CR/optional/location APIs, current admin module permissions | Unauthorized-handler and restricted-admin regressions |
| RLS and inbox privacy | Explicit grants, private helpers, authenticated gateway, ownership/audience policies; no private anonymous reads | Full migration sequence with independent user identities; mark-all beyond 500 rows |
| Attendance integrity | Atomic student submissions and manual mobile attendance; no attendance-created enrolment | Successful submission, wrong code, missing enrolment, distance, duplicate and rollback checks |
| Booking consistency | Room-locked approval checks; teacher and CR requests use backend; permanent routine remains administration-owned | Overlap rejection and adjacent-booking acceptance |
| Notification delivery | Server-owned creation, transactional outbox, required edge secret; active enrolment recipients | Database outbox/inbox checks; live FCM remains a deployment check |
| Solver reproducibility | Seed, bounded nodes, counters, eight component penalties, actual/unknown capacity, section/Saturday scoring | Synthetic feasible and invalid fixtures; independent output validation; two identical runs |
| Build and packaging | Direct ESLint command, Node declaration, bundled fonts, lockfile updates, CI; private Android release signing guard | Web production build, TV test/type/build, Flutter analysis/test/debug APK |
| Installation and release | Ordered baseline/migrations, environment templates, non-destructive mobile config bootstrap, setup instructions | Fresh schema applied by automated tests; release archive and production migration remain unperformed |

The software checks do not establish GPS authenticity, a production threat-model review, real-device FCM delivery, large-instance performance, usability or institutional impact. A real deployment must validate its data migration, accepted database signing key, authorization policies, storage policies and account provisioning in staging. The user has no production Android application ID/Firebase registration yet; the app's debug configuration remains available, and release builds require private production configuration.

See [SETUP.md](SETUP.md) for commands, compatibility changes and configuration limits. Exact test output for this working session is under the workspace `tmp/` directory; CI runs the committed checks independently.
