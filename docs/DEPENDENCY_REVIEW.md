# Dependency review during the correction

A clean install reported 17 affected packages, including a critical Next.js advisory. Compatible lockfile updates moved Next.js/eslint-config-next to 16.4.0, sharp to 0.35.5, Mammoth to 1.13.0, and patched other compatible transitive packages. The release checks were rerun after these changes.

The production-only audit now reports **zero critical/high advisories** and three moderate affected packages in the Mammoth CLI chain (`mammoth -> argparse -> sprintf-js`). Source inspection shows that Mammoth's `bin/mammoth` uses argparse; the web app calls Mammoth's library API rather than that CLI. This is a scoped reachability observation, not a claim that an upstream advisory disappears.

The complete audit still reports twelve affected packages, including build-tool chains rooted in braces and PostCSS selector parsing. The registry's latest braces is 3.0.3 and latest sprintf-js is 1.1.3; the reported ranges include those versions. Automatic force fixes propose a Tailwind 4 migration and a Mammoth downgrade. Those changes are not silently applied to the evaluated UI/parser. No zero-advisory or comprehensive security-certification claim is made.

The exact audit JSON and logs are included in the evidence package. Relevant advisory families:

- [Next.js ImageResponse issue](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j), corrected by the dependency update.
- [Braces nested-pattern denial of service](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), remaining build-tool dependency.
- [PostCSS selector complexity](https://github.com/advisories/GHSA-rj75-hqrm-r3gf), remaining build-tool dependency.
- [sprintf-js precision denial of service](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), remaining Mammoth CLI dependency.

Review the remaining chains when upgrading the build framework/parser or accepting untrusted build inputs. Keep the paper's security claims limited to the executed authorization/transaction cases and the documented deployment limits.
