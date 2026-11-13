# Mobile SES lockdown

This is the standalone SES prerequisite extracted from PR #12155 (OK-56774).
LavaMoat package policies, installation admission, and protected WebEmbed assets
remain in that follow-up PR.

## Runtime boundary and startup order

On iOS and Android, `main` and `background` have independent JavaScript heaps.
Both Metro bundles load the adapter-local SES Hermes prelude and repair script
before React Native initialization. Each entry then runs the existing synchronous
OneKey polyfills, prepares Hermes Promise rejection tracking, and calls
`finishMobileLockdown` before marking runtime capabilities ready or loading wallet
services. A missing prelude or failed intrinsic integrity check aborts startup.

`@lavamoat/react-native-lockdown@1.0.0` pins its own `ses@1.15.0`. The existing
web SES helper continues using its current version and options. Mobile rejects a
second/vanilla SES copy, and the native shared loader cannot initialize one.

The adapter uses `unsafe-eval`. This freezes JavaScript intrinsics, including
Object, Array, Function, and Promise prototypes. It is not package isolation,
safe-eval confinement, host-global freezing, worklet protection, or isolation of
native resources. MMKV, database handles and native singletons may still be shared
between the two runtimes.

## Build mode and rollback

Lockdown is enabled by default. Build with `ONEKEY_MOBILE_LOCKDOWN=false` to produce
a rollback artifact; only the literal values `true` and `false` are accepted.
Rollback is build-time only: a partially repaired or frozen live realm cannot be
unfrozen. Rebuild both version-locked bundles and restart the app.

Metro cache versions and development-vendor fingerprints include the selected
mode. A vendor bundle built with another mode must not be paired with the delta.
The existing union/split serializers and non-zero module IDs are preserved.
Security preludes bypass application Babel transforms through a parse-only path
restricted to their resolved files.

Hermes Promise rejection hooks are registered before hardening. Sentry and the
application update observers afterward instead of replacing the frozen Promise.
The explicit rollback/non-Hermes path retains the existing Promise fallback.

## Verification

Run the focused bootstrap, Hermes rejection tracker, native Sentry and background
entry tests, plus the existing shared SES tests. Run
`node apps/mobile/scripts/check-mobile-lockdown.js` both with the default mode and
with `ONEKEY_MOBILE_LOCKDOWN=false`. The script checks real Metro/Expo transforms,
independent main/background VM fixtures and Hermes bytecode compilation in debug
and release modes. It does not execute a native iOS or Android app.

Before release, validate fresh iOS and Android Debug/Release builds against the
exact artifact: cold start, login/unlock, wallet creation/import, DApp browser,
signing, hardware transport, background tasks/notifications, and rollback.
Historical native receipts from the combined PR do not validate this extraction
or the newer base branch. No protected WebEmbed acceptance is claimed here.
