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
2. In the bundle CDN dashboard
   (`https://bundle-test.onekey-asset.com` → admin), mark the bundle as
   `disabled` for that `appVersion`. Verify by `curl`-ing the manifest
   endpoint and confirming it no longer references the disabled version.
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
2. Trigger `release-native-bundle` workflow with `appVersion=<n>` and a
   new `bundleVersion` (monotonic; this is the
   `${commit_count}${YYMMDD}${rev}` convention).
3. Block the publish step on the integrity check passing (Phase 3 of the
   segment async-paths fix plan).
4. Publish to CDN.

## Step 4 — Postmortem

Record:

- Bad bundleVersion, good bundleVersion replacing it.
- Time-to-detect, time-to-mitigate.
- Any safeguards that should have caught it (likely: a build-time check
  was missing — add it).

## References

- [Plan: segment async-paths rewrite fix](../plans/2026-04-28-segment-async-paths-rewrite-fix.md)
- [Build-time integrity gate: `apps/mobile/scripts/check-split-bundle-integrity.js`](../../apps/mobile/scripts/check-split-bundle-integrity.js)
- Sentry issue: `REACT-NATIVE-4AX` (iOS 6.3.0-10069276 `Requiring unknown module "777"` crash)
