# OTA Bundle Recovery Runbook

## When to use this runbook

A native bundle has been published to the OTA CDN that crashes on a known
device path (current example: iOS 6.3.0-10069276 crashes on entering the
Send recipient page with `Requiring unknown module "777"`). Until users
upgrade to a newer build that ships a corrected built-in bundle, every
launch of the affected version pulls the broken OTA and re-crashes.

## Decision matrix

| Severity                        | Action                             |
| ------------------------------- | ---------------------------------- |
| ≥ 1% of sessions crash on entry | Take the OTA offline immediately   |
| Specific page only              | Take the OTA offline + ship hotfix |
| Edge case (rare device)         | Ship hotfix on next normal release |

## Step 1 — Take the broken OTA offline

1. Identify the bad bundleVersion (from Sentry `dist:` tag or BundleUpdate
   log line `currentBundleVersion: <ver>`).
2. In the bundle CDN admin dashboard for the affected environment
   (production or staging — confirm the host with the on-call lead;
   the JS bundles for the env are downloaded from the same host shown
   in the BundleUpdate `downloadBundle:` log line you used in step 1),
   mark the bundle as `disabled` for that `appVersion`. Verify by
   `curl`-ing the manifest endpoint and confirming it no longer
   references the disabled version.
3. Devices on launch will re-fetch the manifest, see no eligible OTA, and
   fall back to the built-in bundle that shipped with the .ipa/.apk
   (`builtinBundleVersion` in BundleUpdate logs).

## Step 2 — Confirm devices are recovering

Watch:

- Sentry release-health page for the affected `release:` tag — the new
  events/hour line should drop within ~10 min as launches pick up the
  built-in bundle.
- The same log line `[BundleUpdate] bundleURL(RELEASE):` should now read
  `fallback common.bundle=...app/common.bundle` instead of OTA.

## Step 3 — Build and publish the corrected OTA

1. Land the underlying fix on `x` (or the active hotfix branch).
2. Trigger the `release-native-bundle` workflow with `appVersion=<n>`
   and a new monotonic `bundleVersion`. Either via the GitHub Actions
   UI (Actions → release-native-bundle → "Run workflow") or via gh CLI:

   ```
   gh workflow run release-native-bundle.yml \
     --ref x \
     -f appVersion=<n> \
     -f bundleVersion=<commit_count>${YYMMDD}<rev>
   ```

3. Confirm the build-time integrity check passed (the workflow already
   runs `node apps/mobile/scripts/check-split-bundle-integrity.js` as
   a hard gate before any artifact upload — see References below).
   If the workflow fails at that step, the OTA is NOT published; fix
   the underlying serializer/manifest issue and rerun.
4. Publish to CDN.

## Step 4 — Postmortem

Record:

- Bad bundleVersion, good bundleVersion replacing it.
- Time-to-detect, time-to-mitigate.
- Any safeguards that should have caught it (likely: a build-time check
  was missing — add it).

## References

- Build-time integrity gate: [`apps/mobile/scripts/check-split-bundle-integrity.js`](../../apps/mobile/scripts/check-split-bundle-integrity.js)
- Sentry issue: `REACT-NATIVE-4AX` (iOS 6.3.0-10069276 `Requiring unknown module "777"` crash)
