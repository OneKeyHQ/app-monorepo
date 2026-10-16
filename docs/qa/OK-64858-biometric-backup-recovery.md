# OK-64858: biometric backup recovery

## Implementation and scope

Targets iOS/Android only. The background runtime owns all recovery operations and
serializes them; main accesses the service through the existing proxy. Keychain /
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

## Product decisions before readiness

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

## Automated validation

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
physical devices; the PR must stay draft until the device matrix and product
wording/reenrollment decisions above are resolved.

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
