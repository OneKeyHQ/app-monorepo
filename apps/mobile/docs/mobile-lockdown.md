# Mobile SES lockdown

This is the standalone SES prerequisite extracted from PR #12155 (OK-56774).
LavaMoat package policies, installation admission, and protected WebEmbed assets
remain in that follow-up PR.

## Runtime boundary and startup order

On iOS and Android, `main` and `background` have independent JavaScript heaps.
Both Metro bundles load the adapter-local SES Hermes prelude and repair script
before React Native initialization. Each entry then runs the existing synchronous
OneKey polyfills, prepares the active Promise and rejection tracking, and calls
`finishMobileLockdown` before marking runtime capabilities ready or loading wallet
services. A missing prelude or failed intrinsic integrity check aborts startup.

`@lavamoat/react-native-lockdown@1.0.0` pins its own `ses@1.15.0`. The existing
web SES helper continues using its current version and options. Mobile rejects a
second/vanilla SES copy, and the native shared loader cannot initialize one.
The local raw repair prelude retains the adapter's options and Hermes Promise
restoration with `localeTaming: 'unsafe'`, preserving locale-aware address
comparison and number formatting before intrinsic freezing.

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
Non-Hermes builds install the npm Promise and rejection hooks before hardening;
the finalizer also hardens this vetted replacement because SES collected its
intrinsic graph during repair. Sentry uses the prepared observer on both engines.
The explicit rollback path retains the existing late Promise fallback.

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

## Diagnostic integrity and mobile library checks

The developer diagnostics clear the previous report before each run and disable
copying until a new report is available. Failed or timed-out runs cannot leave a
previous green report visible. Superseded runs and unmounts abort their resources;
late results are ignored. Behavior checks have a 10-second deadline, each runtime
report and the background RPC have a 30-second deadline, and the UI run has a
65-second deadline. Fetch's 5-second deadline includes consuming the response body.

The same library tasks run in the native report and in isolated child processes
using the adapter-local SES 1.15.0 Hermes prelude and the production repair script.
They cover decimal.js, axios, bn.js, elliptic and inversify after hardening,
including public signing vectors and wrong-message rejection. The child-process
tests execute Node; native simulator receipts provide the Hermes evidence.

## Opt-in Release/Sentry acceptance

Build a simulator Release app through the normal union/split pipeline with
`ONEKEY_MOBILE_SES_ACCEPTANCE=true`, `ENABLE_NATIVE_BACKGROUND_THREAD=true`,
`UNION_BUILD=true` and `SENTRY_DISABLE_AUTO_UPLOAD=true`. Leave the acceptance flag
unset for normal builds. Its Metro cache namespace is separate, and development
vendors explicitly clear it.

This opt-in production test build uses the real React Native Sentry SDK with a
local, in-memory transport and a public fixture DSN. No envelope is sent to a
Sentry server. Ten seconds after each runtime initializes Sentry, it tests direct
capture, the native synchronous error handler, unhandled rejection and later
handled rejection. It requires exactly one sanitized envelope with stack frames
per fixture, observes the handled callback and verifies Promise identity/freezing.
It then runs the normal SES report, including the mobile library tasks.

Each independent JS heap writes a `[MobileSesAcceptance]` receipt to NativeLogger.
Require fresh `status: pass` receipts for both `mobile-main` and
`mobile-background`, with `dev: false` and `nodeEnv: production`. Receipts contain
only public fixture metadata. This validates SDK capture, normalization,
sanitization and transport delivery; remote ingestion, server-side source-map
symbolication and native fatal-crash delivery require separate acceptance.
