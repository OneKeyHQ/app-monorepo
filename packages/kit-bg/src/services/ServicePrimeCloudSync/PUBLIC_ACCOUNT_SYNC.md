# Public account copy: OK-64559 phase 2

This phase copies already acquired **public account data** through the existing
Cloud encryption, authentication, Account data type, and sync pool. It does not
sync seeds, mnemonics, private keys, passphrases, PINs, sessions, pairing secrets,
or hardware SDK response blobs. The phase 1 credential provider is unchanged.

## Receiving wallet and security boundary

The receiver must already have the corresponding wallet. It matches wallet kind,
canonical full XFP, and standard/hidden-wallet classification before doing any
per-account work. Software HD/Keyless additionally requires the existing local
encrypted seed credential. No match, missing credential, ambiguous matches, or
an unsupported hardware vendor leaves the record pending. No wallet, placeholder,
watch-only downgrade, or private credential is created.

Both hardware and software use a dedicated copy path, not `createAccounts`,
`prepareAccounts`, `getAddressesFromHd`, device calls, or signatures. Hardware
records retain the receiver's device association and hidden-wallet state. HD
records retain the receiver's encrypted credential. Ordinary transaction signing
keeps using the existing wallet/keyring and its checks.

Matching trusted local identity and credential presence is **not** a fresh proof
that every copied address came from that seed. There is deliberately no seed
derivation. Existing public APIs validate address syntax and, when available,
public-key/address consistency. BTC also checks the account xpub checksum,
neutered form, depth, child index and public address map. These public checks do
not prove a hardened ancestor's relationship to the hardware seed. Historical
OneKey EVM/Solana records can have an empty public key; their provenance remains
the authenticated Cloud record plus the existing local wallet binding.

## V1 data and compatibility

The snapshot has its own schema/version and required capabilities, independent
of App version and local DB schema version:

- `schema: onekey-public-account`, `version: 1`.
- Required capability: `account-copy-v1`.
- Wallet fields: kind, full XFP, hidden boolean.
- Account fields: supported chain/network, coin type, complete path, index,
  template and suffix, name, address, pub, and applicable xpub/descriptor/relative
  address map. Local IDs are rebuilt with the receiver's wallet ID.
- Explicit field allowlists reject unknown fields at the raw envelope, payload,
  snapshot, wallet and account levels. `findAddresses`, custom address caches,
  local device IDs, SDK data and credentials are never projected by the builder.

The wire data type remains `Account`. A separate reserved account ID,
`cloud-public-account:v1:<identity hash>`, creates a separate sync key; it is never
an actual local account ID. Wallet kind/full XFP/hidden classification and chain,
network scope, template, path, index and suffix identify the record. Addresses or
names cannot change its path identity. Existing Account name-only records keep
their existing IDs and behavior.

The frozen Account reader from `7140d4061b` (unchanged from `x@53a793b2`) is tested:
it queries this reserved ID, finds no local account, and skips the snapshot,
including future records and tombstones. It still processes ordinary name-only
records in the same batch. We do not introduce an unknown outer data type, which
would make that older dispatcher throw. This is evidence for this verified
reader, not a guarantee about every historical App build or migration tool.

Future incompatible formats or required capabilities **must increment the format
and reserved ID namespace**. New readers must not reuse a v1 key for incompatible
data. This reader rejects unknown versions/capabilities/chains/derivations,
preserves the pool/cloud record, and shows an update hint. It does not guess a
converter or treat the record as empty/deleted. Known v1 records are never rebuilt
by a full initialization scan when their key already exists. Local source writes
also carry an in-memory version precondition checked in the DB transaction; a
future record arriving between build and commit rejects the stale write and its
queued upload. This is local optimistic concurrency, not a server CAS protocol.

The existing, currently uncalled mode-conversion utility also refuses unknown
snapshot formats rather than re-encrypting them. Encrypted records belonging to
another Cloud key are not implicitly migrated by plaintext filling.

## Supported data in this implementation

- OneKey hardware and software HD/Keyless wallets already present locally.
- Bitcoin mainnet: BIP44, nested SegWit, native SegWit and Taproot account paths.
  Taproot retains the existing bare or fingerprint/path-qualified public
  descriptor; a missing or mismatched descriptor is rejected. Private extended
  keys and arbitrary descriptor text are not accepted.
- EVM: default, Ledger Live and Ledger Legacy templates, using EVM network IDs.
- Solana: default and Ledger Live templates.

Other chains, BTC testnet, variant account layouts and third-party hardware are
not copied by v1. Imported/private-key and watch-only accounts retain their
existing name-only sync behavior. An unsupported format stays pending rather
than creating a different wallet type. Only chains/accounts already present in
the snapshot are restored; creating another chain's new account still follows
the normal wallet flow.

Same local ID/path with different identity fields is a conflict, never an
overwrite. Names and existing account records are retained on idempotent replay.
BTC display-address differences are treated conservatively as conflicts; the
receiver's selected address is never silently replaced.

## Work and memory budgets

- Match wallets once per import round using an identity index. Cache positive
  and negative credential/device results only for that round, then clear them.
- Copy at most 50 records per account transaction. Recheck wallet/device and HD
  credential in the transaction, check cancellation before commit, and insert
  accounts and their indexes together. No per-account creation, echo sync row,
  network call or event is generated by import.
- Existing scene markers checkpoint successful records in batches of 50. A crash
  between account commit and marker commit is safe to retry by identity.
- Yield between batches. Cancel/lock/source changes invalidate pending work;
  committed earlier batches remain valid and retry is idempotent.
- Snapshot plaintext is at most 16 KiB, with at most 64 BTC map entries. Account
  ciphertext/raw input is bounded before parsing. Once encrypted, public snapshot
  plaintext is not duplicated in the persistent pool's `rawData` cache.
- Shared initialization work runs with at most 50 lookups in flight. Existing
  rows encrypted for the current Keyless or OneKey ID key are not re-encrypted
  during every scan. Live changes remain incremental dirty pool records.
- Ordinary DB triggers coalesce by ID for one second: one status request for the
  union, followed by uploads of at most 50 records and 256 KiB of actual serialized
  UTF-8 body bytes, whichever binds first. Uploads are sequential. Oversized single
  items fail before any upload. Flush/reset keep their old whole-request meaning.
- Queue failures retain/recover pending work; a newer queued value wins. Durable
  dirty pool records remain the recovery source after process restart. Cancellation
  also stops ordinary uploads between batches; a request already sent may finish,
  and its records can be retried with the remaining dirty work.

These are **client budgets**, not verified server limits. The existing status API
still takes a metadata union (`key/type/timestamp`) and returns its existing diff;
no unsupported status pagination or backend fields were invented. Backend request
and response limits, total account capacity, and retry semantics need confirmation
before claiming arbitrary large Cloud spaces. The isolated tests cover 100 and
1,000 account copies and 1,000 source triggers; they do not establish production
latency or an unlimited capacity guarantee.

## Deletion and failure behavior

Explicit account/index deletion atomically writes a public snapshot tombstone,
then schedules one debounced sync. A tombstone suppresses future automatic copy
and is retained; it does not delete an existing account on another device. Re-add
does not silently override it. Releasing a suppression needs a separate explicit
product action, not a scan or rename.

Wallet removal/unbinding and automatic duplicate-wallet merge remain local. They
do not delete Cloud account backups or generate account tombstones. If that
wallet is later added again, live backed-up accounts may be restored; explicitly
deleted/tombstoned accounts remain suppressed.

A new plaintext tombstone can wait in the existing pool until Cloud credentials
are available; filling encrypts its validated canonical data without looking up
or recreating the deleted account. If an existing encrypted record cannot be
validated because credentials are unavailable, or has an unknown format, deletion
fails before the local account is removed. No unsupported record is overwritten
to make deletion appear successful.

## Isolated validation and local acceptance

All tests use public synthetic fixtures, mock wallets/storage/transports, and
in-memory credentials. No real wallet, hardware or production Cloud was used.

```sh
yarn jest --runInBand \
  packages/kit-bg/src/services/ServicePrimeCloudSync/ \
  packages/kit-bg/src/services/ServiceKeylessCloudSync/ \
  packages/kit-bg/src/dbs/local/LocalDbBase.test.ts \
  packages/kit-bg/src/dbs/local/LocalDbBase.publicCloudAccounts.test.ts \
  packages/kit-bg/src/dbs/local/LocalDbBase.publicCloudAccountDeletion.test.ts \
  packages/kit-bg/src/dbs/local/LocalDbBase.publicSnapshotWriteGuard.test.ts \
  packages/kit-bg/src/services/ServiceAccount/ServiceAccount.keylessRemovalPhase.test.ts \
  packages/kit-bg/src/services/ServiceKeylessWallet/utils/keylessSyncCredentialStorage.test.ts \
  packages/shared/src/utils/hardwareCloudSyncGuards.test.ts \
  packages/kit-bg/src/apis/BackgroundApiBase.hardwareCloudSync.test.ts \
  packages/kit-bg/src/services/ServiceSend.hardwareCloudSync.test.ts \
  packages/kit-bg/src/services/ServiceDApp.deriveContextHash.test.ts
node --test development/scripts/hardware-cloud-sdk-redaction.node-test.js
yarn agent:check --profile commit
yarn workspace @onekeyhq/desktop build:renderer:startup-budget
DESKTOP_RENDERER_STARTUP_BUILD_DIR="$PWD/apps/desktop/web-build" yarn workspace @onekeyhq/desktop check:renderer-startup-budget
```

The 2026-10-24 cloud run passed 31 Jest suites / 365 tests and 3 SDK redaction
Node tests. The desktop renderer production build completed with 13 dependency
warnings. All default startup budgets passed: 5,325 modules / 6,800, initial raw
scripts 12.84 MiB / 15 MiB, all raw scripts 99.65 MiB / 105 MiB. Isolated call-count
checks show 1,000 imports use 20 account transactions, and 1,000 ordinary source
hooks coalesce into one status request and 20 upload requests. These are mock
control-flow measurements, not production throughput benchmarks.

For local acceptance use isolated disposable wallets and a test Cloud space:

1. Keep phase 1 credentials ready on both devices. Add the same hardware wallet
   (and the same hidden wallet when applicable) or software HD/Keyless wallet on
   the receiver first. Do not restore secrets through Cloud.
2. Create supported accounts on the source, disconnect hardware completely on
   the receiver, then sync. Accounts/indexes should appear without device prompts
   or software address creation. Existing account IDs and device ownership stay
   local. Transaction signing still requires the appropriate hardware/secret.
3. Repeat sync, restart mid-import, cancel/lock, and retry. Names and identity
   fields on existing accounts must not be silently replaced. Repeat with a
   missing software credential, unrelated wallet, and different hidden wallet:
   no account should be created.
4. Use a prepared test dataset of 100/1,000 accounts and inspect aggregate request
   counts and batch sizes, never log secrets. Verify multiple source events do
   not generate one status/upload per account.
5. Test account deletion, local wallet unbinding, same-path conflicts, a newer
   format, and a supported older reader against the same test space. Unknown
   records must remain intact and produce an update hint on this reader.

Native runtime/UI behavior, real server limits/large-space behavior, all historical
client combinations, and actual transaction signing need local/end-to-end
acceptance. The cloud tests establish copy/control logic, not these release gates.
