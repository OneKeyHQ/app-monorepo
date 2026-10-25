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
  Mainnet xpub/ypub/zpub are accepted with Base58Check, public-node, depth and
  hardened account-index validation. ypub requires BIP49 and zpub BIP84;
  canonical xpub remains compatible with the existing firmware fallback.
  Testnet/private/unknown versions and script mismatches are rejected.
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
- Copy at most 50 records per account transaction. Advance accountHdIndex once
  per batch to max(current counter, highest accepted index + 1), preserving all
  other counters. Conflicts/pending records cannot move it; cancellation rolls
  back accounts/indexes/counter together. Allocation explicitly fails on search
  exhaustion, read failure or the hardened-index boundary, never returning an
  occupied index.
- Recheck wallet/device and HD
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
- Ordinary DB triggers coalesce by ID for one second with a five-second maximum
  wait and a 500-record immediate-drain threshold. One in-flight drain owns the
  source lock; new records wait in the ID map for a follow-up, without rescanning
  the whole account DB. One status request carries the union, followed by uploads
  of at most 50 records and 256 KiB of actual serialized
  UTF-8 body bytes, whichever binds first. Uploads are sequential. Oversized single
  items fail before any upload. Flush/reset keep their old whole-request meaning.
- Queue failures retain/recover pending work; a newer queued value wins. Durable
  dirty pool records remain the recovery source after process restart. Cancellation
  also stops ordinary uploads between batches; a request already sent may finish,
  and its records can be retried with the remaining dirty work.

Sync-pool writes also use at most 50 records per transaction and yield between
batches. Account/index insertion or deletion stays atomic in its own transaction.
This is separate from the sync-pool checkpoint transaction; retry is idempotent.
Each deletion batch currently reads the Account table once to preserve any index
still referenced by another account. There is no new DB index/schema migration.

## Full reconciliation and backend contract

Full/manual/startup recovery checks regenerate **all current-space pool metadata**
after each saved response. Ordinary events still send only their changed union,
and never serve as the next full-round summary. The existing
`onlyCheckLocalDataType` mapping is preserved: full checks use the historical
wallet/account subset; ordinary checks use the historical wider type list. This
is a request field, not proof of backend return filtering.

The optional request capability is
`reconciliation: { version: 1, maxItems: 500, maxBytes: 1048576 }`.
A supported backend must compute differences against the complete supplied
summary **before** limiting the result, include deletion work, and limit the sum
of `diff + updated + deleted + obsoleted` to 500 and the UTF-8 serialized response
to 1 MiB. It must return:

```ts
reconciliation: {
  version: 1,
  maxItems: 500,
  maxBytes: 1048576,
  diffBeforeLimit: true,
  includesDeleted: true,
  hasMore: boolean,
}
```

`hasMore: false` means all relevant work was considered under that contract;
empty `diff`, a small batch, or successful local import alone is not completion.
All four work types are applied/uploaded before honoring that result. Uploads
retain existing timestamps and authentication/nonce behavior. The server must
compare versions on writes and must advance deletion acknowledgement so a saved
`deleted` ID is not returned forever with the same metadata. This repo contains
no backend implementation: these are **interface and launch requirements**, not
verified production behavior. Pair bounded responses with capable clients;
do not silently truncate responses for already released legacy clients.

Unknown/missing response capability preserves the existing single-response
behavior and records `backend-unverified`; it does not auto-loop or claim full
completion. A first 400/422 capability rejection retries once without that field;
authentication failures never use this compatibility fallback. The unsupported
capability is remembered for this service lifetime. No server cursor, challenge,
new encryption container or new conflict-version system is introduced.

Each runner round allows at most eight checks and 20 seconds, with a 10-second
HTTP timeout, two finite retries and 250ms–2s backoff. The initial legacy
capability fallback can add one HTTP request. A progressing round that reaches
its budget yields and resumes after at least one second. Repeated responses,
no progress, malformed data, response/summary limits or exhausted retries stop
fast requests, persist a blocked state and retry with 30-second exponential
backoff capped at 30 minutes. Triggers cannot bypass that cooldown. Each full
summary is limited to 8 MiB and 100,000 records, before transport. These are
client bounds, not a claim of arbitrary server capacity.

Unfinished state and counters are persisted, and startup/unlock/network/foreground
wakeups recheck lock, selected key and Cloud availability. A source generation
and abort signal invalidate old work. Cancellation waits for an active write's
commit guard before releasing the source lock. Local replay of previously
acknowledged records (including the v2 deletion upgrade) is separate from the
network round and is not claimed to fit the network's 20-second budget.
Downloaded records awaiting a matching wallet, supported format or conflict
resolution are tracked separately and replayed locally without refetching them.

The Cloud settings page shows one aggregate running/waiting/complete/partial/
blocked row and existing pending counts. Issue IDs stay in background SimpleDB;
UI receives counts only. Resolving one record clears only its own issue, so a
later successful batch cannot erase earlier errors. Background batches add no
per-account toast or loading dialog. Existing manual sync verification/loading
remains; incomplete manual sync reports pending rather than success.

On iOS/Android/extension, main and background are isolated JS runtimes. Main
sends wake signals and receives small atom counters; background owns the issue
map, credentials, HTTP and DB mutations through existing storage/DB facades.
No new native handle or storage backend is allocated. A large issue map is not
sent to/deserialized in main. Desktop/web use the existing single JS runtime.
Native readiness and background timer suspension still require platform tests;
main wake signals do not override background lock/key/availability checks.

## Deletion and failure behavior

Explicit account/index deletion atomically writes a public snapshot tombstone,
then schedules one debounced sync. Tombstone writes precede local deletion inside
that same transaction. The operation checks both the optimistic rejection marker
and a transaction-local readback of the exact persisted version. A concurrent
update, unknown format or LWW refusal rolls back the entire account/index/batch
and its partially written tombstones. Retry rebuilds against the latest record;
it does not override a rejected/future version. The winning supported tombstone also deletes
the matching public account on the receiving device, while retaining its wallet,
seed/credential and hardware association. Only unreferenced indexes are removed.
Before committing, copy/delete rechecks the current winning pool record, source
generation and wallet binding. Older offline records keep their old timestamp;
ordinary initialization/scan never revives the newer tombstone.

Only the explicit user account-creation entry receives an in-memory, nonserializable
capability to re-add an absent account. It restores the retained indexed-account
name when available, otherwise the snapshot name, and atomically creates the
account/index plus a live version strictly newer than the tombstone. The normal
user creation flow may derive a newly requested address; remote copy never does.
Automatic creation, scans, renames, JSON RPC input or an expired capability do
not release a tombstone. This reuses existing timestamp conflict resolution,
not a new server CAS or causal-version protocol.

Wallet removal/unbinding and automatic duplicate-wallet merge remain local. They
do not delete Cloud account backups or generate account tombstones. If that
wallet is later added again, live backed-up accounts may be restored; explicitly
deleted/tombstoned accounts remain suppressed until an explicit user re-add.

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
  packages/kit-bg/src/dbs/local/LocalDbBaseIndexedAccount.test.ts \
  packages/kit-bg/src/services/ServiceAccount/ServiceAccount.keylessRemovalPhase.test.ts \
  packages/kit-bg/src/services/ServiceAccount/ServiceAccount.operationLease.test.ts \
  packages/kit-bg/src/services/ServiceBatchCreateAccount/ServiceBatchCreateAccount.concurrentFlows.test.ts \
  packages/kit-bg/src/dbs/simple/entity/SimpleDbEntityCloudSyncAccountIssues.test.ts \
  packages/kit/src/views/Prime/hooks/CloudSyncReconciliationEffect.test.tsx \
  packages/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress.test.tsx \
  packages/kit-bg/src/services/ServiceKeylessWallet/utils/keylessSyncCredentialStorage.test.ts \
  packages/shared/src/utils/hardwareCloudSyncGuards.test.ts \
  packages/kit-bg/src/apis/BackgroundApiBase.hardwareCloudSync.test.ts \
  packages/kit-bg/src/providers/ProviderApiBtc.hardwareCloudSync.test.ts \
  packages/kit-bg/src/vaults/impls/btc/KeyringHardwareBtcBase.hardwareCloudSync.test.ts \
  packages/kit-bg/src/vaults/impls/btc/KeyringHardwareTrezor.test.ts \
  packages/kit-bg/src/vaults/impls/btc/KeyringHardwareKeystone.test.ts \
  packages/kit/src/views/Prime/pages/PrimeCloudSync/HardwareCloudSyncKeySection.test.tsx \
  packages/kit-bg/src/services/ServiceSend.hardwareCloudSync.test.ts \
  packages/kit-bg/src/services/ServiceDApp.deriveContextHash.test.ts
node --test development/scripts/hardware-cloud-sdk-redaction.node-test.js
yarn agent:check --profile commit
yarn workspace @onekeyhq/desktop build:renderer:startup-budget
DESKTOP_RENDERER_STARTUP_BUILD_DIR="$PWD/apps/desktop/web-build" yarn workspace @onekeyhq/desktop check:renderer-startup-budget
```

The earlier 2026-10-24 baseline cloud run passed 31 Jest suites / 365 tests and 3 SDK redaction
Node tests. The desktop renderer production build completed with 13 dependency
warnings. All default startup budgets passed: 5,325 modules / 6,800, initial raw
scripts 12.84 MiB / 15 MiB, all raw scripts 99.65 MiB / 105 MiB. Isolated call-count
checks show 1,000 imports use 20 account transactions, and the baseline 1,000 ordinary source
hooks coalesced into one status request and 20 upload requests. The new queue
threshold can intentionally start a drain earlier. These are mock
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
5. Test account deletion on A and actual deletion on B, offline older B records,
   explicit same-account re-add/name restoration, local wallet unbinding,
   same-path conflicts, a newer format and a supported older reader. Unknown
   records must remain intact and produce an update hint on this reader.

Native runtime/UI behavior, real server limits/large-space behavior, all historical
client combinations, and actual transaction signing need local/end-to-end
acceptance. The cloud tests establish copy/control logic, not these release gates.

For a contract-capable test backend, prepare more than 500 records including
tombstones; verify fresh full summaries each response, `hasMore` exhaustion,
eight-check yielding/resumption and persisted recovery after restart. Repeat
with a duplicate batch, no progress, 400/422 legacy negotiation, prolonged
offline errors, lock/cancel and a key switch during a held transaction. Verify
blocked retries remain bounded and downloaded-but-pending records do not cause
network drain loops. Real backend version comparison/deletion acknowledgement,
native/extension wake lifecycle, hardware confirmation and phase-1 deterministic
signing remain separate release gates. No production endpoint was tested here.

The 2026-10-25 synthetic metadata benchmark used 10,000 rows: 1,900,001 UTF-8
bytes, 43 ms, and about 16.0 MB additional Node heap in one cloud regression run.
The assertion budgets remain 5 seconds and 64 MiB. This measures metadata
validation/sorting/serialization/hashing, not DB ciphertext loading, device
heap, network throughput or total account-space memory. Full-summary generation
still reads the existing current sync pool through its existing DB API.

## Earlier local independent review

Review scope: changes after `34a6fee0aa9f1524cc60b139c0858abe451e4a75`,
without a PR, production backend or device access. Independent reviewers checked
public copy/delete/re-add and reconciliation/cancellation separately.

Confirmed findings fixed before delivery:

- A timed-out runner could release the source lock while apply was still active.
  It now waits for active apply/upload settlement, and transactions check the
  originating abort signal and generation before commit.
- Incremental checks and raw snapshot filling could capture a generation too
  late. They now propagate the initial source generation through HTTP, pool
  writes and scene application; late results are rejected.
- Old-space completion/cooldown and issue counts could suppress or contaminate a
  newly selected space. Wakeup selects current-space state first; a fresh space
  resets aggregate issues and forces local compatibility replay.
- Threshold events could queue redundant drains. A single in-flight drain and
  coalesced follow-up now preserve dirty records without a retry busy loop.

| Dimension | Score | Assessment |
| --- | --- | --- |
| Security | 8/10 | Public allowlist, source/transaction guards, no new secret protocol |
| Code quality | 8/10 | Bounded runner, cancellation and persistence regressions |
| Architecture | 8/10 | Existing crypto/pool/DB and separate main/bg ownership |
| Completeness | 7/10 | Backend/native/device acceptance remains external |
| Weighted total | 7.9/10 | Client review complete; release requires the listed acceptance gates |

The earlier review missed the follow-up defects below; its statement of no
confirmed client blocker was superseded by the subsequent counter-review. This
historical score does not certify server version checks, native lifecycle or
hardware behavior. No PR was created and no review comment was published.

The earlier client regression run passed 40 Jest suites / 453 tests, plus 3 SDK
redaction Node tests. The production renderer build completed with 13 dependency
warnings. All unchanged default desktop startup budgets passed: 5,326 / 6,800
modules, 12.86 / 15 MiB initial raw scripts, and 99.69 / 105 MiB all raw scripts.
These checks do not cover native/extension UI, real hardware or the backend
contract. The final pre-commit gate result and commit are recorded in the handoff.

## Follow-up fixes after 28fdad0075

Four phase-2 defects were confirmed and fixed after the first delivery:

1. Account/index/bulk deletion now verifies tombstone rejection **and actual
   persisted version** before deleting locally, in one transaction. Real manager
   fixtures cover concurrent pool updates, partial-batch LWW refusal and future
   encrypted formats. Readback does not change timestamp policy.
2. Real software BIP49/84 and the locked SDK batch formatter produce ypub/zpub.
   These are accepted only for the matching mainnet script/version, checksum,
   depth and child index. Public-address/map/pub and descriptor validation is
   retained. Test data comes from the existing non-production Core vector and
   executes the installed SDK's exact public-node formatter in isolation; it
   does not instantiate a hardware SDK or certify firmware output.
3. Public import updates the wallet's next index transactionally and monotonically.
   Allocation has explicit exhaustion/read-error behavior. Sparse indexes,
   shared indexes, 1000+ imports, larger existing counters, cancellation and
   2^31 exhaustion are covered. Replaying already accepted public records also
   repairs an older stale counter, without a schema migration. The existing
   explicit manual force-sync/replay route can perform that reconciliation;
   allocation fails safely if the metadata has not yet been reconciled.
4. Response duplicate fingerprints use semantic key/type/time/delete/space, not
   ciphertext. Production receipts count accepted version/deletion changes,
   excluding ciphertext-only updates and known rejected/conflicting accounts.
   Unknown formats and missing wallets may remain safely downloaded/pending.
   An explicit zero receipt cannot manufacture progress from a changed raw pool
   summary; legitimate uploads and actual deletion acknowledgements still advance.
   A metadata row physically removed by its existing manager counts only when
   that response explicitly acknowledged deletion and the row previously existed.

Stable-version ciphertext churn now blocks and follows increasing 30-second
backoff instead of repeatedly taking one-second budget continuations. Healthy
large datasets still use the existing eight-check/time budget and resume. The
new regression covers repeated rounds, rejected records, sticky and physical
delete acknowledgements, upload-only work and future-format local replay. No
server causal version, cursor, encryption format or production configuration was
introduced. Backend contract acceptance is still mandatory.

The phase-1 exact-message guard and saved-key Resume fixes are carried into this
branch as a separate commit; see HARDWARE_CLOUD_KEY.md. Normal Legacy account
100 is usable again without changing the frozen Cloud derivation path. Existing
Keyless secure-storage preference/fallback and cache boundaries are unchanged.

Independent reviewers cross-checked deletion/counter changes and BTC formats.
The semantic-progress review caught a physical metadata-delete ACK regression;
that was corrected with a production-service integration regression before
delivery. Cancellation during the saved-key enable setter was likewise tested
and corrected in phase 1. These tests remain isolated doubles/public vectors,
not native DB, production backend or physical hardware acceptance.

| Follow-up review dimension | Score | Scope |
| --- | --- | --- |
| Security | 8/10 | Transactional deletion and unchanged secret/protocol boundaries |
| Code quality | 8/10 | Semantic progress, monotonic counters and explicit allocation failures |
| Architecture | 8/10 | Existing sync-pool/TX/credential infrastructure retained |
| Completeness | 7/10 | Production backend/native DB/device acceptance remains external |
| Weighted total | 7.9/10 | Confirmed client defects fixed; release gates remain explicit |

Follow-up validation on 2026-10-25 passed all 46 focused Jest suites / 570 tests.
The final rerun passed 43 TypeScript suites / 558 tests and 3 TSX suites / 12
tests separately after correcting three test-runner paths that had omitted the
`x` suffix; those path errors were not test assertion failures. All 3 SDK
redaction Node tests and the unified commit gate passed. The production renderer
compiled with 13 dependency warnings. Unchanged default budgets all passed:
5,327 / 6,800 modules, 12.11 / 14 MiB startup modules, 23 / 30 initial scripts,
12.86 / 15 MiB initial raw, 3.32 / 3.8 MiB gzip, 2.64 / 3 MiB Brotli,
387.8 / 650 KiB largest module and 99.69 / 105 MiB all raw scripts.
These results validate isolated client logic and build budgets, not backend,
native storage/UI or physical hardware acceptance.
