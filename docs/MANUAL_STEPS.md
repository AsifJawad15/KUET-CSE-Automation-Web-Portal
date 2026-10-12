# Exact remaining manual/account steps

The code, complete reconstructed SQL, tests, manifests, source archives, and corrected manuscript are prepared locally. The remaining actions need your account permissions, live deployment configuration, devices, or author confirmation.

## 1. Install in fresh staging Supabase projects

1. Open the Supabase dashboard and create/select a **new empty staging academic project**.
2. Open **SQL Editor**, create a new query, paste `academic-install.sql` from the release package, and run it. It contains the complete academic sequence in one transaction.
3. For a separate new CMS project, run `cms-install.sql`. It contains `database/cms_baseline.sql` then `database/cms_security_boundary.sql`.
4. In the web checkout, copy `.env.example` to `.env.local` and enter the academic URL/public key and server-only service-role key. Enter the separate CMS values when using two projects.
5. Generate a private session secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and store it in `AUTH_SESSION_SECRET`. Do not publish it.
6. Configure `SUPABASE_JWT_SECRET` with an HS256 project signing secret accepted by PostgREST. If your project only accepts asymmetric keys, the current gateway needs an appropriate signing adapter before live use; the setup document describes that limitation.
7. Privately run `node scripts/generate-admin-credentials.cjs` on your machine and save the generated password securely. Edit `supabase_bootstrap_first_admin.sql`: replace `__YOUR_ADMIN_EMAIL__` with your email and `__YOUR_PRIVATE_BCRYPT_HASH__` with the generated hash. Run that edited SQL in the academic dashboard. The template rejects unchanged placeholders and ships no shared working password. Add synthetic teachers, students, offerings, enrolments, and rooms for staging verification. Teachers created by a bulk routine import now receive an unknown random password; use the private administrator recovery workflow to provision their individual passwords before sign-in.
8. Deploy the corrected backend and matching mobile client, then regenerate timetable drafts. Drafts lacking the new `activity_id` mapping are intentionally rejected.

**Existing production projects:** do not paste the fresh-install baseline over them. Export a backup, restore a staging copy, compare its actual tables/enums/functions and migration history with this reconstructed schema, and test the staged upgrade first. The reconstruction is not claimed to match the unavailable original security files or your production data. Existing duplicate enrolments/attendance keys and enum differences need explicit reconciliation.

If your deployment used the old shared bootstrap password, rotate that account's password. The corrected template now requires a private hash; the password-change/session-version mechanism invalidates old application sessions. Confirm the final account can sign in with its new password.

## 2. GitHub publication and upstream review

The local correction branch is `fix/softwarex-submission-20261012`. The web checkout's origin is the AsifJawad15 fork of the repository you linked. Read `release-metadata.json` for the final commit and any verified pushed branch.

If remote publication could not complete automatically, from the web root run:

```powershell
git push -u origin fix/softwarex-submission-20261012
```

On GitHub, compare that fork branch against `abdullahshahporan/KUET-CSE-Automation-Web-Portal` master and open a pull request. Review the reconstructed-release provenance and new database tests. Merge after CI and author/deployment review. Create the final versioned release from the merged commit and record its full SHA. Mobile documentation changes, if present, have the same correction branch in the mobile fork and need the equivalent upstream review.

Update manuscript code metadata with the exact final public commit/archive rather than assuming an earlier main-branch commit contains these fixes.

## 3. Update and execute Code Ocean capsule 5295445

Public retrieval did not expose the capsule files, and the in-app browser backend could not connect in this session. The archive's contents/DOI scope are therefore not asserted as verified.

1. Sign in to the owning Code Ocean account and open capsule `5295445`.
2. Create a new editable version/copy for the corrected release. Import the prepared source/evidence package without credentials or uncleared personal media.
3. Copy the contents of the package's `web/` folder into the capsule's Code folder, then copy `codeocean/run` to `run` at that folder's root and make it executable (`chmod +x run`). Keep the independent checker, synthetic input, normalized output, and Node lockfile together. The script works from either its supplied subfolder or the Code root.
4. Select Node 24.19.0 (or a documented supported Node 24 environment), install using `npm ci`, then execute the run script. Compare counters and the normalized output hash with the package.
5. A solver-only capsule must say **solver reproduction only**. To claim full release verification, also provision isolated local PostgreSQL, set `TEST_DATABASE_URL`, and run `npm run verify:release`; retain its case-level logs. Never replace this with a source build or skipped database test.
6. Inspect Code, Data, Results, authors, source commits, environment, and executable entry point from a fresh independent/public session. Publish the corresponding capsule version.
7. Copy the actual version-specific DOI and scope into Table 1 C3 and the availability statement. Retain `10.24433/CO.0434258.v1` only if it actually identifies the evaluated contents; do not assign an invented DOI.

The corrected manuscript retains no unsupported 56-activity comparison. If an older submitted manuscript still contains it, replace that manuscript or remove the larger comparison everywhere; keeping it requires recovering and reproducing its exact original evidence.

## 4. Confirm media rights and author declarations

1. Use `asset-inventory.json` and `ASSET_PROVENANCE.md` to review existing application/README images. For each retained third-party or identifiable-person image, record source, owner/license, and any needed publication permission. Replace anything uncleared with author-owned demonstration material.
2. The corrected manuscript uses five new editable diagrams with recorded Codex/GPT-6 assistance and contains no personal-data screenshots. Review their labels against the implementation and confirm the AI methods/declaration text.
3. If adding screenshots, capture a staging instance populated solely with synthetic account/academic records. Use names such as `Demo Student 001` and clearly artificial rolls, not operational rosters. Record the synthetic fixture and image ownership in the captions/provenance file.
4. Confirm authorship roles, corresponding-author details, funding, and competing interests with all authors. The inherited declarations must not be treated as confirmations obtained during this code task.

## 5. Device/deployment acceptance and submission

On a configured physical Android device, verify password sign-in/logout, teacher/CR permissions, the published timetable, location permission denial, attendance distance/code/duplicates, and notifications for the correct recipients. Configure Firebase only with your registered app and private server-side FCM credentials. Configure a protected outbox retry scheduler and test delivery with the app closed.

The supplied debug APK is a testing build. A store release is not required by the correction memo. If submitting to a store, register the production application ID and configure private signing/Firebase files as documented in the mobile setup; do not reuse debug signing.

Submit the reviewed corrected manuscript, the final publicly accessible versioned package/capsule, and the B1-B7 response table after the account, media, and device checks above. Preserve the exact final logs and hashes.

The corrected draft was prepared from the workspace's root `main.tex`; that source differs from the September 17-page manuscript identified in the memo. Use the supplied corrected manuscript after author review, or transfer its verified release metadata/workflow/counts/disclosures to the actual final source you intend to submit. Do not submit an older PDF retaining the missing-SQL or unsupported-benchmark claims.
