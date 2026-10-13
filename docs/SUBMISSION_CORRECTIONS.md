# October correction release 0.2.0

The missing SQL was reconstructed and tested as a **new release**, not represented as recovery of the unavailable September files. The original manifest remains in `migration-manifest.september.json`; the current manifest covers twelve academic migrations plus the CMS baseline and boundary. The October 13 compatibility migration and live verification are recorded in [LIVE_VERIFICATION_20261013.md](LIVE_VERIFICATION_20261013.md); the case counts below describe the earlier October 12 run.

| Item | Implemented correction | Evidence | Remaining action |
|---|---|---|---|
| B1 | Complete tracked schema, security/transaction SQL, new manifest, strict release CI | `migration-manifest.json`, `tests/database.test.cjs`, `tests/cms-boundary.test.cjs`, release log | Public archive/capsule must identify this newly tested release |
| B2 | Current-state validation and revision-protected atomic publication, database resource guard, transactional outbox | `atomicDraft.ts`, `commit_routine_draft`, route rollback and real concurrent-cohort tests | Hosted staging configuration/device checks |
| B3 | Stable activity IDs, complete peer moves, draft scope, saved options, atomic metrics/labels | `draftState.ts`, generation/edit route, persisted-state regressions | Regenerate old drafts without IDs |
| B4 | Reproduced seven-activity example; corrected manuscript retains no 56-activity result | `examples/routine/`, `scripts/reproduce.cjs`, independent checker | Verify capsule scope/version; do not retain an older larger-experiment claim without its exact evidence |
| B5 | Required manifest and real PostgreSQL checks in CI; actual logs/counts | Web 39 runner cases + PostgreSQL 6 runner cases, all pass with no skips; TV 10 pass; mobile 4 pass | Confirm GitHub CI on final public branch and cite final archive/commits |
| B6 | Five new editable manuscript diagrams, caption disclosures, general/methods AI declaration | Corrected manuscript/diagram source, `ASSET_PROVENANCE.md` | Authors review final technical content before submission |
| B7 | Corrected manuscript uses new diagrams with no personal screenshots/photos | Diagram source and asset inventory | Authors clear existing application/README images; capture any future screenshots with synthetic data |

## Executed environments and checks

- Windows, Node 24.19.0; web lint, type checking, production build, and full release verification passed.
- Compatible dependency updates removed the critical Next.js advisory and runtime high advisories. Remaining build-tool/Mammoth-CLI advisories are recorded in `DEPENDENCY_REVIEW.md`; no complete security certification is claimed.
- The ordinary suite reports 39 passing runner cases; the separate PostgreSQL 18.4 suite reports six. Counts include parent tests containing subtests; full case-level logs distinguish the actual scenarios. No required database test skipped.
- PGlite applies the complete academic migration sequence and checks authorization/session/attendance/outbox behavior. The CMS test installs its separate baseline and boundary.
- Publication/edit tests call the real Next.js handlers with an adapter that provides Supabase response shapes while reads/RPC writes hit the isolated database. This verifies the handlers, validator, and transaction functions; it does not emulate every PostgREST/hosted Supabase behavior.
- Real PostgreSQL uses independent connections and an isolated, randomly named database. A stale snapshot, revoked current session, or competing cross-cohort publication is rejected. At most one conflicting publication commits.
- TV source 1.1.0: ten tests, renderer/Electron type checks, and builds passed.
- Flutter 3.44.1, Dart 3.12.1: locked dependencies resolved, analysis passed with zero errors/warnings (291 informational diagnostics), and four tests passed. The debug APK built successfully using Android Studio JBR Java 21.0.10; CI remains pinned to Java 17. Existing plugin deprecation notices did not prevent this testing build.
- Solver reproduction returns three drafts, seed 42, 24 nodes, zero backtracks, 186 pruned values, three attempts; two normalized runs are byte-identical. Raw penalties remain 59/62/80 and scores 41/38/20. Correct per-activity warning deduplication changes warning counts and the output checksum; use the current `environment.json` checksum.

## Transaction design

The server reads `get_routine_revision` before fetching draft/current constraints. All relevant table writers acquire a shared transaction advisory lock and increment the revision through statement triggers. The service-only commit checks the current actor, signed-session version, module permissions, and unchanged revision under that same lock. This binds validation to the state that commits, including updates that happen between separate reads.

Only after this gate does the function save full peer rows, labels, and metrics; publication also replaces the intended selection, records a version, changes selection state, and inserts notifications/outbox rows. SQL errors roll everything back. External push dispatch happens through the existing retry pipeline after commit. The coarse global lock favors correctness over throughput and is not evidence of production scalability.

The production TypeScript validator and independent fixture checker have separate purposes. Missing stable IDs or changed activity requirements require regeneration, rather than guessed identity backfills.

See `MANUAL_STEPS.md` for exact account, hosted deployment, media, and submission actions. Local test success alone is not a completed production deployment or journal submission.
