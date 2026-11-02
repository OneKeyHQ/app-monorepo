# OK-65971: retry interrupted biometric backup enrollment

## Evidence and scope

Jira reports cancellation during backup / first download on App 6.7.0. This
investigation uses development branch `x`, commit
`36b3dc9340e005c34317b2535ea503cf7ac3d620` (`.env.version`: 6.7.0).
The dependency at that revision is `expo-secure-store@58.0.2`; the older native
audit in OK-64858 is historical, not device validation for this revision.

- `useCloudBackup.doBackup` calls `serviceCloudBackupV2.backup`. After upload,
  download/content/listing verification and account checks, `backup` calls
  `cacheBackupPassword` with the new record ID.
- `useCloudBackup.doRestoreBackup` calls `prepareLocalRestore` without a password
  first. A cache miss opens the backup-password dialog. Manual submission calls
  `prepareLocalRestore` with a password; bg downloads that selected record,
  decrypts it and checks the account before calling `cacheBackupPassword`.
  Incorrect passwords fail decryption before cache mutation.
- `restorePreparePrivateData` also caches only after decryption. Recordless
  password setup/verification cannot create a cache entry.
- `LocalBackupPasswordCache.set` journals `{keyRef}` before the protected write,
  then commits `{keyRef, ciphertext}`. Android's authenticated write can reject
  on cancellation. The old `get` ignored the resulting pending entry and the old
  `set` refused every existing entry. Its regression test explicitly expected no
  retry. No UI offered a way to forget an interrupted entry.

Android and iOS run main/bg in separate JS runtimes. Only bg owns this cache and
its mutex; main calls the existing background proxy. SecureStore/Keychain/Keystore
are shared native resources, with separately deserialized JS values per operation.
No main initialization order or shared JS heap is assumed. Desktop/web are single
runtime targets and do not enroll this native-only cache.

## Recovery behavior

Only entries with **no ciphertext field** can retry through `set`. Complete
entries, including empty/corrupt ciphertext or missing/invalidated protected keys,
stay paired; cancelling an existing protected read never deletes it.

A pending entry can mean cancellation, a native write with uncertain outcome, or
a successful native write followed by failed manifest commit. Under the existing
bg mutex, retry rejects a reference shared with another scope, removes the old
protected item using its own service, checks real persistence, then journals a
fresh random reference before writing a fresh protected key. No authenticated
read-back or plaintext fallback is introduced. A failed deletion retains the old
journal. A failed journal write prevents protected creation. A failed protected
write or final commit retains an erasable pending reference for another attempt.
The existing erasure marker/tombstone and reset barrier remain in force.

This changes only the optional local recovery credential. Wallet databases,
remote backups, native authentication policy and encryption formats are unchanged.

## Validation

Five focused Jest suites pass, **220 tests**: encrypted cache, restore service,
real persistence facade, ServiceApp reset and native storage adapter. Running the
four new cancellation/retry cases against the original `x` cache implementation
fails all four (both providers plus Android backup/first restore). The original
source is injected by a temporary Jest transformer without changing the worktree.

`agent:check --profile commit` passes every gate, including type-aware lint and
full TypeScript (199 seconds with `GOMEMLIMIT=10GiB`, `GOGC=50`, four Go workers).
An initial concurrent Jest/TypeScript attempt exhausted the 16 GB container and
is discarded; the successful final Jest and commit checks ran sequentially.

Regression coverage includes both
supported providers, cold retry, repeated cancellation, uncertain native writes,
failed/no-op journals, failed final commit, paired-read cancellation, corrupt
complete entries, cross-record isolation, concurrent enrollment, reset draining,
and masking during retirement. Android service tests use the real cache and real
encryption with mocked native storage for both backup and first-restore paths,
including wrong password before correct-password retry and cold biometric restore.

Physical Android/iOS biometric validation and native app builds were not performed.
Required acceptance with synthetic data:

- Android 6.7.0: cancel enrollment during backup and during first restore; restart,
  select the same record, enter a wrong password, then the correct password and
  complete the new biometric prompt. Restart again and restore with biometrics.
- Repeat cancellation, denial and lockout; each correct-password retry remains
  available. Cancellation must not fail the successful backup/manual preparation.
- Upgrade with an existing pending entry, including a native key written before
  interrupted ciphertext commit. Verify another backup/account remains usable.
- Cancel an already enrolled record's read; manual fallback and later biometric
  restore still work without re-enrollment or changes to its pairing.
- Exercise native foreground/background transitions and reset while enrollment
  is pending. Ordinary reset preserves recovery; security erasure drains the write
  and removes recovery. No real wallet or cloud-backup data is used by unit tests.
