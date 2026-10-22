# OK-64858: biometric backup recovery

## Implementation and scope

Biometric recovery targets iOS/Android only. The background runtime owns all
recovery operations and serializes them; main accesses the service through the
existing proxy. Keychain /
Keystore are shared native resources. No decrypted key is cached in either JS
heap. The existing one-use, 60-second restore handle stays in bg and is invalidated
when reset starts. An in-flight preparation cannot publish a handle after reset.

A dedicated SecureStore manifest holds provider/account/record scope, random key
references and authenticated password ciphertext, outside SimpleDB and wallet
storage. Each record has its own random key and isolated `keychainService`.
Only those keys use `setSecureItemWithBiometrics`; ordinary secure writes contain
no plaintext passwords or random keys. No old unprotected cache is imported.

Eligibility uses SecureStore's current biometric capability check, without
memoization. Missing hardware, enrollment, strong authentication support or native
API support fails closed. New entries are written only for verified backup
records or successful manual decryption. Existing entries (including pending,
missing or invalidated keys) are never implicitly replaced. Recordless provider
password setup/verification does not create an entry.

The manifest journals the key reference before protected creation, then commits
ciphertext. A partial write remains unavailable and erasable. Protected keys are
never read back on creation. Explicit restore reads only the selected record;
any cache/authentication/decryption failure returns to its backup-password dialog.
There is no current-password fallback, App-password fallback or system PIN path.

## Reset call-site audit

- `Setting/pages/Tab/CustomElement.tsx` -> `useResetApp()` preserves recovery.
- `AppStateLock.tsx` -> `useResetApp({ inAppStateLock: true })` preserves recovery
  after the existing user-confirmed reset dialog.
- `PasswordVerifyContainer.tsx` -> `useResetApp({ silentReset: true })`, triggered
  by `WrongPasscodeMaxAttempts`, erases recovery.
- Direct/unknown `ServiceApp.resetApp()` callers default to erasure. The private
  `resetData()` has no other production caller.
- Secure erase closes operations, persists an erasure tombstone, deletes every
  protected item, then deletes the manifest. Errors do not skip wallet erasure;
  reset reports failure and does not restart. A persisted tombstone denies reads
  after interruption and supports retry. Ordinary reset never snapshots/restores
  wallet data or copies secrets around the general storage clear.

## Product follow-ups

1. Existing manual reset confirmation uses `reset_app_desc`, with erase-oriented
   wording. Product/localization should explicitly explain that this device's
   biometric backup recovery survives manual reset. Generated translations have
   not been edited. Security-triggered reset must continue erasing recovery.
2. Re-enable/forget UI for invalidated or interrupted entries is not introduced.
   Recommend explicit per-backup “forget saved recovery” followed by verified
   password and opt-in enrollment. Until then existing entries stay unchanged and
   manual password restore works. New records can enroll independently.
3. SecureStore can reject large values on some OS versions. A large manifest
   therefore makes new cache writes fail closed while leaving prior committed
   entries intact. Measure practical limits with a large backup history; consider
   a dedicated persistent ciphertext store if capacity requires it.

## Native source audit (not device validation)

Audited npm `expo-secure-store@57.0.1`, matching this repository's dependency:

- iOS `SecureStoreModule.swift`: eligibility uses
  `deviceOwnerAuthenticationWithBiometrics`; key ACL is `biometryCurrentSet`;
  device-only accessibility is preserved. Fresh insertion does not prompt;
  authenticated retrieval does. Retrieval searches both namespaces, so new keys
  use a fresh dedicated namespace and are never written without authentication.
- Android `AuthenticationHelper.kt`: eligibility checks `BIOMETRIC_STRONG`.
  `AuthenticationPrompt.kt` authenticates a `CryptoObject`, with cancel and no
  device-credential allowance. Reads and writes may prompt.
- Android `SecureStoreModule.kt`: writing with an invalidated Keystore alias can
  remove other authenticated entries sharing its service. Unique services prevent
  one backup from doing this to another or to the App unlock credential.
- The repository's existing SecureStore patch prevents destructive deletion on
  certain failed Android reads. No third-party/native patch is added here.

## Required device acceptance (pending)

Use synthetic wallets only; do not use real user secrets.

- iOS Face ID and Touch ID; Android Class 3 fingerprint and weak-face-only device.
- Create two backups with different passwords; manual reset, kill app, relaunch,
  reconnect same cloud account, recover each with one fresh authentication.
- Cancel/deny/fail/lock out authentication: backup-password dialog appears,
  incorrect password can retry, correct input restores without changing another
  record. No authentication during listing/render/background probes.
- No hardware/no enrollment/weak-only: backup and manual restore work; no
  protected key or cache entry is created, including after reset/cold start.
- Change enrollment, remove a protected item, corrupt ciphertext: manual fallback,
  no replacement of existing pairing, unrelated backups remain intact.
- Interrupt each journal/reset stage. Ordinary reset keeps recovery; security
  reset cannot recover from a tombstoned manifest; failed erase can retry and
  still erases wallet storage. Check an already prepared restore is invalidated.
- Test foreground/background native runtime bridge, Face ID permissions and
  Android activity ownership with real app builds, plus native bundle budgets.
- No promise of reinstall persistence, device migration, or new macOS support.

## Initial implementation validation (before reset follow-up)

The focused Jest validation passes 6 suites / 141 tests (the final cache-only
rerun passes 42 tests, including corrupted cross-record reference deletion):

- `localBackupPasswordCache.test.ts`
- `ServiceCloudBackupV2.localRestore.test.ts`
- `ServiceApp.resetApp.test.ts`
- `useCloudBackup.localRestore.test.ts`
- `Setting/hooks/index.test.tsx`
- `biometricStorage.native.test.ts`

These use mocked native storage/authentication with real password encryption for
cache tests. They are not native biometric acceptance. Module registry validation
passes with 25,614 active modules and 2 tombstones; no new production module ID is
needed. The native-storage compatibility and background-API contract checks pass.

Full-repository `tsc:staged` passes. Native authentication remains unverified on
physical devices. The PR is Ready for review at the user's explicit direction;
readiness does not imply native acceptance or resolution of product follow-ups.

The iOS union JS/Hermes build and bundle architecture check pass. Registry
validation also passes against its fresh `dist/module-id-map.json` (one build
map). Startup budgets pass at the repository CI limits:

| Runtime | Modules | Module limit | Code size | Size limit |
| --- | ---: | ---: | ---: | ---: |
| main | 2,725 | 3,000 | 13.96 MB | 14 MB |
| background | 2,286 | 2,600 | 17.69 MB | 19.5 MB |

Main has little remaining size headroom. This build validates JS/Hermes artifacts,
not physical-device biometric access or Android native runtime behavior.

`agent:check --profile commit` passes. The final `--profile pr` run passes all
local gates, including full TypeScript. GitHub CLI PR detection receives HTTP
403 in this environment, so remote PR creation/status uses the connected GitHub
app instead; local gates are not evidence of remote CI completion.


## Reset and import review follow-up

Based on PR head `c8f3f2c2240a5eef1274bde1ddb4863cd1602df0` (same file contents
as the original implementation commit; history was rewritten).

- The SecureStore facade exposes whether persistence is real. Recovery operations
  check it around asynchronous storage calls. Masked read/null and successful no-op
  writes/deletes cannot count as successful erasure. No operation bypasses masking.
  Normal UI/proxy reachability of the reported masked-reset chain is **not**
  established: Travel Mode command policy denies `serviceApp.resetApp` and does
  not allow `serviceCloudBackupV2`. This is a defensive invariant repair, not
  evidence of an exploited or reachable critical vulnerability.
- Security erasure first writes a separate device-only intent item, independent
  of manifest parsing/writing. A successful intent write denies cold reads even
  if both the manifest tombstone write and a protected-key deletion fail. Every
  referenced key is still attempted. Unprotected marker/manifest writes and
  deletions are read back; protected keys are never read to verify writes/deletes.
  The intent is removed only after all referenced keys and the manifest are gone.
- A later ordinary/preserve reset completes prior erasure intent or a tombstone;
  it never treats interrupted security erasure as permission to retain recovery.
  Failures are reported with a sanitized error and keep the retry state.
- All persistence can fail. If intent **and** tombstone writes fail and a key
  deletion fails, no durable deny state can be guaranteed across process death.
  The current runtime blocks cached recovery and retains erasure intent in memory,
  still wipes wallet data, and reports failure without automatic restart. After
  a forced relaunch, a surviving pair still requires successful system biometrics.
  This is not an authentication bypass. The tests explicitly document this limit.
  Changing the requirement to stop wallet erasure in this case needs product /
  security approval; this patch does not make that tradeoff.
- bg owns a recovery generation and a mutex for actual import writes. Desktop/web
  use the same ordering in their single JS runtime for existing manual cloud
  restore; no biometric cache APIs are called there. Reset
  invalidates handles and in-flight preparation immediately. Continuations check
  generation after account lookup, selection, password verification and import
  initialization. Reset also releases the old import task's ownership while its
  password dialog is pending, so fresh recovery can start after a failed reset.
  Reset drains an already-started import before wallet erasure;
  account/network/App-password preparation outside the write barrier cannot hold
  reset waiting for that dialog. No timeout releases a still-running writer into
  an erased database. Slow active imports and already-pending native SecureStore
  calls can delay reset; native interruption/latency needs device acceptance.
- The entire ServiceApp reset is serialized. Failure releases the lifecycle only
  after reset unwinds, enabling a fresh manual-password attempt without reviving
  old continuations. Cache erasure failure remains blocked independently from
  manual recovery. Successful reset stays closed until the cold restart.
- App biometric-unlock preference and dedicated backup-recovery authentication
  remain independent, per the approved design. No switch coupling, PIN fallback,
  lock-screen preservation change or new macOS biometric support is introduced.

Added regression coverage exercises the real Travel Mode storage facade with its
actual runtime persistence policy and a mocked native store, simultaneous failures,
cold instances, preserve-reset retries, late consumed handles, password-validation
boundaries, in-progress import drain, overlapping resets and failed-reset release.
These are simulation tests, not physical iOS/Android authentication validation.

Follow-up Jest validation: 7 suites / 171 tests across the full 166-test run and
final affected-suite reruns (cache 54, real persistence facade 3, restore service
72, ServiceApp 15). The ServiceApp suite also connects the real cloud service's
import barrier to reset and checks the last wallet write precedes the actual
`resetData` call. No production wallet database is touched by these tests.

The follow-up iOS union JS/Hermes build, architecture check and registry check
against the new build map pass. Startup budgets remain main 2,725 modules /
13.96 MB and background 2,286 / 17.69 MB; limits are unchanged. This is bundle
validation, not real-device biometric validation.

Follow-up `agent:check --profile commit` passes all checks, including full
TypeScript (334.6 seconds). The PR profile also passes all local checks and its
TypeScript rerun (47.4 seconds); GitHub CLI repository lookup fails with HTTP 403,
so remote CI is unverified. An earlier concurrent type/lint run exhausted the
16 GB environment and was discarded; the serialized reruns above are successful.


## Preserve-reset metadata failure follow-up

Based on user head `607572117f`. Ordinary preservation inspects the independent
intent item and the manifest's erasure envelope without requiring usable cache
entries. Corrupt JSON, invalid entries or native read errors do not turn that
ordinary preservation into erasure and do not block the cold restart. The cache
is left byte-for-byte unchanged: no automatic manifest deletion, marker clearing,
replacement, repair or new erasure intent.

Observed intent is sticky in the bg-owned cache instance, including intent seen
by an earlier cache read. An independent marker or readable manifest tombstone
therefore still requires completion of erasure even when entries are invalid or
later reads fail. Those failures keep the existing wallet-wipe/error/no-restart
behavior, for both preserve and security resets. Masked persistence is still an
explicit failure, not a successful erase.

Unreadable is unknown, not absent: if both reads fail before any intent has been
observed, ordinary preservation can restart without claiming any erasure. All
existing bytes/markers remain, and a later readable cold reset honors them. A
readable tombstone is inspected even if the independent marker read fails, and a
readable independent marker is honored even if the manifest read/parse fails.
The unresolved policy for simultaneous failure of all persistent writes and key
deletion is unchanged by this follow-up.

ServiceApp/cache regression tests verify `resetData` and `restartApp` behavior
for corrupt JSON, invalid schema (including otherwise retained entries), native
read failures, independent markers, manifest tombstones, sticky observed intent,
and a transient outage followed by a cold retry, with preserve true and false.

Targeted final regression run: 3 suites / 98 tests pass (ServiceApp 41, encrypted
cache 54, actual persistence facade 3). Native storage/authentication remain
mocked; no real-device authentication claim is made by this follow-up.

## October 22 monitor follow-up

- Capture recovery generation at backup, password setup, and verification entry;
  pass it through cache writes. A continuation from before reset cannot enroll
  recovery again after failed wallet reset releases the lifecycle. Deferred
  upload/download/list/status tests cover the empty-backup path and a fresh retry.
- Erase only the selected local pairing before deleting its cloud record. Local
  erasure errors are sanitized and propagated, keeping the remote retry target.
  A cloud deletion failure after local erasure leaves manual-password recovery.
- Export decrypts directly without enrolling or authenticating recovery material.
- Protected reads/writes receive the existing localized verify-backup-password
  prompt. Android SecureStore now rejects a false SharedPreferences commit result
  without authenticated read-back. Android autolinking builds only
  `expo-secure-store` from source: Expo 57 otherwise uses its unpatched bundled
  AAR, so patching the Kotlin file alone does not ship the fix. This requires a
  rebuilt Android binary; a JS-only update cannot replace the native module.

Independent Mac validation against merged x `8bfb6014` and its unchanged lockfile:

- Ten focused suites / 257 tests pass: the six cloud-handoff suites (189), actual
  persistence facade (3), onboarding restore UI and import ownership/exit (65).
  Native storage/authentication use synthetic mocks; encryption is real.
- Restoring the old late-generation helper makes all four deferred backup/reset
  regressions fail by detecting a new cache write; the reviewed implementation
  passes and permits a fresh retry.
- `agent:check --profile commit` passes, including full TypeScript, typed lint,
  formatting, native storage policy and background API/test integrity checks.
- The Expo patch applies to the pristine Yarn archive and matches installed
  source. Targeted Gradle `:expo-secure-store:compileDebugKotlin` passes. Compiled
  bytecode branches on `saveEncryptedItem` and throws `WriteException` on false;
  the published AAR instead discards that result.
- iOS production union build, both unchanged CI startup budgets and three-bundle
  architecture pass: main 2,555 modules / 12.78 MB; background 2,345 / 18.10 MB.
  Module registry and the emitted build map pass (27,241 active / 7 tombstones).
- Existing Mac GitHub authentication works; no cloud credentials were imported.
  Current-head remote CI must be verified separately after pushing.

Physical Face ID, Touch ID and Android Class 3 behavior remains unverified.
Reset disclosure localization and per-backup forget/re-enable still need product
confirmation. The all-writes-and-key-deletes-fail policy remains unchanged:
wallet wipe has priority, failure is reported without automatic restart, and a
surviving pairing after forced relaunch still requires system biometrics.
