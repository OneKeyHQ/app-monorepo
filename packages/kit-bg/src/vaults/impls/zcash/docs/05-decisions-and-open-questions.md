# Decisions & open questions

Why this integration is shaped the way it is, recorded so these don't get
re-litigated from scratch, plus what's genuinely still undecided. Decisions
are dated; treat older ones as more likely to have been revisited than
recent ones — check the linked context before assuming any of these are
still final.

## Decisions

### D1 — Keys and signing: one WASM implementation, all platforms, never split

**Decision**: spending-key material only ever exists inside the `webzjs-keys`
wasm module. No platform gets a second, native key implementation. Sync/scan
is allowed to degrade to a native engine per platform (D2), but it only ever
touches a **viewing** key (UFVK), never the seed or spending key.

**Why**: this is the MetaMask-snap security model — one audited surface for
the part that actually matters (spending), rather than N platform-specific
reimplementations of key derivation and signing that all need to be
independently correct and independently audited.

### D2 — Sync degrades by platform; mobile uses a thin native bridge, not `react-native-zcash`

**Decision**: desktop/web/extension sync directly in WASM (COI works
natively there). iOS and Android both sync through a **thin, self-built RN
native module** bridging the *official* mobile SDKs
(`zcash-android-wallet-sdk` / `ZcashLightClientKit`) — not through the
existing open-source `react-native-zcash` (Edge) package, and not through
GeckoView/WebView-hosted WASM either, despite GeckoView being a proven
solution to Android's COI problem (`docs/04`) — GeckoView was the answer
*while* mobile sync was still planned to go through WASM; the later decision
to move mobile sync to native SDKs entirely made that moot for sync (though
the GeckoView escape hatch itself remains real, wired infrastructure that
could still matter for something else).

**Why `react-native-zcash` was rejected**: its `InitializerConfig` and
`CreateTransferOpts` both require the raw `mnemonicSeed` — it derives keys
and signs internally, with no exposed UFVK/PCZT API. Using it would mean the
seed exists in a second place (inside this native module), directly
violating D1.

**Why the official SDKs work for this despite being full wallet SDKs**: they
already expose exactly the UFVK-only, PCZT-based split this needs, because
they already support Keystone hardware signing the same way —
`importAccountByUfvk` (watch-only sync init, no seed), `proposeTransfer` →
`createUnsignedTransferPczts` → `addProofsToPczt` (all seedless),
`apply_batch_signatures` (takes signatures from anywhere, including our own
WASM signer instead of a hardware device). Building the native bridge means
writing a thin Kotlin/Swift shim around already-existing, already-correct
SDK methods — not implementing sync or proof generation ourselves.

**Not yet done**: the actual Kotlin/Swift bridge. See Open Questions.

### D3 — The split seam is PCZT, the same seam hardware signing will use

**Decision**: wherever key-holding and non-key-holding responsibilities need
to cross a boundary — carrier↔keys-wasm today, eventually app↔hardware-device
— that boundary is a PCZT (hex/bytes), never a lower-level or custom format.

**Why**: this isn't a new design choice we're imposing — it's already how
`librustzcash`'s own `pczt` crate models creator/constructor/prover/signer/
tx_extractor as independent roles (`docs/01`), and it's already how
production Keystone hardware integration works in the official Android SDK
(`docs/01`, `docs/03`). Reusing an existing, ecosystem-proven interchange
means our carrier/keys-wasm split and any future hardware integration are
the *same* code path with a different signer plugged in, not two separate
things to build and maintain.

### D4 — Local wallet DB is a rebuildable cache, never a source of truth

**Decision**: the serialized wasm wallet state (`docs/02`'s sync section) can
be deleted at any time with the only consequence being a rescan from
`birthdayHeight`. The actual source of truth is the UFVK + birthday height in
`SimpleDbEntityZcash` — small, cheap to keep correct, never derived from the
cache.

**Why**: this is what makes the cache-clearing incident in `docs/04`
recoverable-in-principle (losing wallet-state IndexedDB is a resync, not
fund loss) and what justifies GC-on-`AccountRemove` (D5) being safe to run
eagerly rather than needing a grace period or soft-delete.

**Storage location per platform**: carrier-local IndexedDB for
plugin/desktop/web (extension has `unlimitedStorage`; web does best-effort +
`persist()`); mobile gets SQLite for free from the official native SDKs
(D2) instead of needing its own storage design.

### D5 — Deletion is GC-driven, not synchronous with account removal

**Decision**: removing an account doesn't synchronously delete its local
wallet state. `ServicePrivacyChain` listens for `AccountRemove` and reconciles
asynchronously (`docs/02`), plus runs the same reconciliation once at boot as
a backstop for anything missed while the app was closed.

**Why**: decouples "the account is gone from the user's wallet list" (must be
immediate) from "the local wallet cache is cleaned up" (fine to be
eventually-consistent), and the boot-time backstop covers the case where
removal happened in a session that closed before GC could run.

### D6 — Shielded target is Ironwood, not Orchard, as of NU6.3

**Decision**: new integration work targets the Ironwood pool. Orchard support
(receive/balance) is kept for wallets/history that predate the switch, but
Orchard is not the pool new addresses advertise as spendable-into.

**Why**: `docs/01` covers the protocol reason (Orchard circuit soundness
disclosure → NU6.3 turnstile). This decision inherits a general rule worth
keeping for whatever pool comes after Ironwood too: **pools change every few
years by design** in Zcash (Sapling→Orchard→Ironwood), so (a) negotiate a
connected hardware signer's supported pool set before building a proposal
and degrade explicitly rather than ever blind-signing an unsupported pool,
(b) keep branch IDs data-driven, never hardcoded, (c) keep the WebZjs fork
thin so a `librustzcash` bump inherits the next pool's support with minimal
diff, (d) treat pool migration (like the current Orchard→Ironwood turnstile)
as a first-class flow, not an edge case.

### D7 — Ironwood receive/balance shipped without a dedicated commitment tree
(SUPERSEDED 2026-08-18 — full Ironwood tree landed in wasm alpha.13)

**Original decision**: Ironwood note storage and balance summing were
implemented without a third `ShardTree`, leaning on the upstream trait's
valid no-op defaults, since the scope then was receive + balance only.

**Why it was reversed**: the "Note not found" sync-blocker audit
(`docs/04`, cross-pool nullifier trap) showed the tree-less state was one
of five ironwood gaps that would fire in sequence: with sync unblocked,
the wallet's own v6 send change lands as an ironwood-received note, which
without a tree has no witness and is unspendable — and `scan_complete`
hard-errored on any ironwood note position anyway. alpha.13 adds the full
mirror of the orchard wiring: `ironwood_tree` ShardTree (Orchard-shaped
nodes, `ORCHARD_SHARD_HEIGHT`), `WalletCommitmentTrees` ironwood
overrides, put_blocks commitment/frontier/checkpoint insertion with
three-way cross-pool checkpoint alignment, birthday + whole-wallet proto
persistence (empty-bytes-tolerant for pre-alpha.13 records), ironwood in
`select_spendable_notes` / `AccountMeta` / anchor-height minimum /
`truncate_to_height`. Deliberately NOT ported: per-pool scan-progress
ratios still count sapling+orchard only (cosmetic skew, noted in Open
questions).

**Maintenance model (the user's question this answers)**: pool-selection /
consensus logic lives in official librustzcash (pinned rev; upgrades =
bump + rebuild). The ONLY protocol code we own is this vendored
`zcash_client_memory`, and only until upstream ships its own Ironwood
support. Exit strategy: upstream now has a canonical generic
`ll::wallet::put_blocks` (zcash_client_sqlite delegates to it); porting
our store to the `LowLevelWalletRead/Write` traits would delete the entire
hand-rolled put_blocks and end this class of divergence bug permanently.

### D8 — No per-chain `ServiceZcash`; all logic on vault hooks + one shared service

Covered in `docs/03`'s "Vault / KeyringHd seams" section — recorded here as a
decision because an earlier version of this integration did have a
per-chain service, and it was deliberately removed in favor of the current
shape. Don't re-add one without a concrete reason the shared
`ServicePrivacyChain` + vault-hooks shape can't handle.

### D9 — Birthday provenance is wallet-scoped; account height is explicit

**Decision** (built 2026-08-17): `isFreshlyGeneratedMnemonic` is computed
without touching any onboarding screen. `ServiceAccount.generateMnemonic()`
records `md5(mnemonic) -> generatedAt` in an in-memory, one-time-use,
age-pruned map; `createHDWallet`/`createHDWalletWithRevealableSeed` check
the mnemonic they receive against that map before it's consumed. This is
computed centrally at the wallet-creation choke point
(`createHDWalletWithRs`), which emits `EAppEventBusNames.WalletAdded{
walletId, isFreshlyGeneratedMnemonic}`; `ServicePrivacyChain` subscribes and
persists it into `SimpleDbEntityZcash.walletFreshMnemonic`, keyed by
`walletId` — not a new field on the shared `IDBWallet` record.
`KeyringHd.zcashDeriveAndSaveOneAccountMeta` reads it per wallet (not per
account), so a second or third zcash account added under an already-known
wallet inherits the same answer without being asked again.

**Restore input** (built 2026-08-21): BIP39 import in onboarding v1/v2 requires
an approximate first-Zcash-use month. The dialog cannot submit an empty value;
the selected month is carried through the route and account-selector action to
`createHDWallet`, then `createHDWalletWithRs` stores it as
`walletRecoveryBirthdayTimestamps`. This does not replace the fresh-mnemonic
fingerprint: freshness is still detected at the central wallet-creation choke
point, while the route carries restore metadata. Cloud/Prime/legacy paths that
cannot ask remain safe because absent input scans from Sapling activation.

**Why zcash-scoped storage, not the shared `IDBWallet` schema**: the signal
is currently only needed by Zcash. Adding it to the shared wallet schema
would be semantically cleaner (it's genuinely a property of the seed, not
Zcash-specific) but requires a Realm+IndexedDB schema change and a
`LOCAL_DB_VERSION` bump affecting every chain's wallet records —
CLAUDE.md's steer against designing for hypothetical future needs argues for
the narrower, zcash-scoped store now. If a second privacy chain later needs
the same signal, promoting it to a shared field is a reasonable future
refactor.

Every account materializes the result as an explicit `birthdayHeight` plus a
`birthdaySource` (`fresh-wallet`, restore/manual variants, or automatic
recovery). This keeps the scanner input stable and makes support diagnostics
explainable without re-inferring how the wallet was created.

**Allowlist, not denylist — confirmed safe by the same audit**: the rule is
"skip only when `isFreshlyGeneratedMnemonic === true`," never "skip unless
imported." The audit found several wallet-creation paths that correctly
never set this flag at all (cloud restore, hidden wallets, QR/hardware
import, Prime Transfer) and one path (`CreateKeylessWallet`) that internally
conflates a real create with a Shamir-share restore under one label — none
of these can accidentally slip through an allowlist keyed on a positive,
narrow proof of freshness. A denylist ("skip unless known-imported") would
have been vulnerable to exactly this class of gap.

### D10 — Shield button: standalone one-tap flow, not the standard tx pipeline

**Decision** (built 2026-08-17): "shield transparent balance" does not go
through `buildUnsignedTx` → review page → `signTransaction` → broadcast.
`ServicePrivacyChain.shieldTransparentBalance` (the UI door) prompts for the
password directly, then calls `Vault.zcashShieldAndBroadcast`, which chains
`zcashShieldFunds` (create, wraps the wasm `pczt_shield`) →
`zcashProvePczt` → a new `KeyringHd.signShieldPczt` (extracted from
`signTransaction`'s signing logic into a shared private helper,
`signPcztHex`) → `finalizePczt` → `broadcastPczt`, all in one background call.

**Why not the standard pipeline**: the standard pipeline's review page is
real UI weight (full transaction review screen) for an action design already
decided as one-tap (a self-transfer has no destination to review, no
counterparty risk). Reusing it would mean either building a fake
`IEncodedTxZcash` to satisfy pipeline types for an operation that has no
`toAddress`, or accepting a review page nobody asked for.

### D11 — Pool-aware scan bounds: skip pre-support blocks; new-pool support rescans from that pool's activation

**Decision** (2026-08-19, user-set principle): blocks a pool cannot exist in
are never scanned for it, and when the wallet GAINS support for a pool that
activated in the past, scanning re-runs from that pool's activation height —
not from each account's birthday, and never silently skipped.

What already enforces the first half structurally: the scan floor is Sapling
activation (nothing older is ever queued); Orchard/Ironwood outputs simply do
not exist in pre-activation blocks, and their commitment trees start at their
activation frontiers. The registration-birthday clamp (birthday ≤ Sapling
activation → activation + 1) closes the one hole where the account-creation
treestate fetch could target a height the server has no state for (which also
hung the wasm grpc client — see docs/04).

There is intentionally no dormant pool-version migration framework while the
feature remains in development. Adding support for a previously activated
pool requires an explicit runtime change and a reset/rescan from the chosen
activation boundary. The latest destination/change pool remains defined once
in the host policy rather than duplicated in migration metadata.

### D12 — Logic lives in the app monorepo; the wasm fork exposes only primitives

**Decision** (2026-08-20, user-set principle): business logic, policy, and
display computation converge in the TS layer of this monorepo. The wasm fork
holds ONLY what cannot exist elsewhere — wallet-db internals, protocol
cryptography, and narrow primitives over them — because every wasm change
costs a Rust review + rebuild + npm publish + reinstall cycle and drifts the
fork further from upstream.

Boundary test for any new capability: "does this need data or state that
lives inside the wallet db / protocol, with no exposed way to reach it?"
Yes → add the smallest possible primitive (an accessor, a queue mutation, a
bounded step), and put the policy that drives it in TS. No → it does not
touch the fork.

Current surface, audited against the rule: unavoidable — Ironwood
tree/marker/serialization support, PCZT sign/prove/quote, `sync_step`,
`requeue_scan_ranges_from`, and read accessors over private wallet-DB joins.

**Implemented in alpha.24**: the old `extract_transaction_history` display
model was removed. `crates/webzjs-wallet/src/onekey/transaction_facts.rs`
returns neutral account-visible facts only (received/spent/external values,
fee, mined/expiry height, raw status, memos, pool set, and note/UTXO details).
Type classification, signed display value, pending/expired policy, and mixed-
pool presentation now live in `zcashWebSdk.ts`. These UI/model changes no
longer require editing Rust, rebuilding WASM, or publishing another package.

### D13 — The root seed must never enter the main WebZjs package (blast radius = zcash only)

**Decision** (2026-08-20, user-set requirement): a bug or vulnerability in
the WebZjs fork must at worst leak **zcash-scoped** key material, never the
BIP39 root seed (which would compromise every chain).

**Honest current state**: violated. `deriveAccount` and `signPczt` both pass
the root seed into `webzjs-keys` (`UnifiedSpendingKey::from_seed` requires
it). alpha.21's zeroization shortens the exposure window but the exposed
OBJECT is still the root.

**Target architecture — demote the root outside the wall**:

```
root seed ─▶ [tiny deriver wasm]           ─▶ account-level USK bytes ─▶ [WebZjs keys]
             only zip32 / sapling-zip32 /      (Era-encoded, zcash-only        sign/prove;
             orchard-keys crates; frozen,       secret; leak = one zcash       seed params
             auditable, rarely changes          account, not the root)         DELETED from API
```

- The big, frequently-changing fork (signing, proving, scanning, its whole
  dependency tree) only ever receives the account-level `UnifiedSpendingKey`
  (upstream has standard `to_bytes`/`from_bytes`, Era-encoded).
- The root seed's trust surface shrinks to a minimal derivation module whose
  crate set is pinned and diffable in one sitting.
- `webzjs-keys` gains `pczt_sign_with_usk(uskBytes)`; every `seed*` parameter
  is removed from its API so the property is enforced at the type level, not
  by discipline.
- Worst-case leak after this: one zcash account's spending key. Other chains
  untouched by construction.

**Revised and implemented (2026-08-20, wasm ≥ alpha.21)**: the threat survey
corrected an overstatement -- the seed never entered the big networked
`webzjs-wallet` package at all (its API has no seed parameter; that is now a
standing red line). The seed-touching box was always `webzjs-keys` (small,
pure-computation, no networking). The landed form therefore skips the
separate deriver package:

- `derive_from_seed(network, seed, hdIndex) -> { uskBytes, seedFpBytes }` is
  the package's ONE seed-accepting entry; the wasm-side copy is zeroized
  before returning.
- `pczt_sign_with_usk_bytes(...)` signs from the returned bytes -- seed-free,
  and with all key-object lifetimes internal to the call (the
  freed-a-consumed-wrapper bug class cannot occur through it).
- The TS layer (sign + derive) uses only these two; the legacy seed-taking
  constructors remain compiled for compatibility but have no TS callers.
- Remaining discipline: freeze `webzjs-keys` independently of wallet-driven
  upstream bumps (only touch it for keys-relevant changes), and keep the
  wallet-package no-seed red line under review.

The standalone tiny-deriver wasm remains the documented fallback if
`webzjs-keys` ever has to co-evolve with the fork again.

### D14 — One wallet database per network, holding every seed's accounts

**Decision**: there is one local wallet database per `network` — mainnet in one,
testnet in another. Every account the user has, across every wallet and every
mnemonic, registers its UFVK into that one database.

**Why**: scanning is a single pass over blocks that trial-decrypts for all
registered keys at once. Partitioning by seed would make a user with three
wallets scan every block three times, and that cost is paid every day. One
database per network is the floor: each block is downloaded and decrypted once
no matter how many wallets or accounts exist. Battery is the constraint that
drove this — the app is already criticised for background power draw.

**Network cannot be merged further**: a database is created with a `Network`
parameter, and consensus rules, activation heights and address prefixes differ
between them. This is a constraint, not a choice.

**Why mixing seeds is safe** — the question this decision most invites, so the
evidence is recorded here rather than left to be re-derived:

- Note selection is account-scoped in SQL, not by convention:
  `... INNER JOIN accounts ON accounts.id = rn.account_id WHERE accounts.uuid
  = :account_uuid`. The account is a required parameter all the way up through
  `select_spendable_notes` and `propose_transfer`; there is no call shape that
  omits it.
- The database holds viewing keys only (`accounts.ufvk`). Spending keys never
  enter the runtime — signing derives them from the seed inside the keys
  package. Even a selection bug could not produce a valid signature for another
  account's note, because that needs the other account's seed.
- The schema is designed for this: `UNIQUE (hd_seed_fingerprint,
  hd_account_index)` — the seed fingerprint is carried per account, not per
  database.
- Each account's UFVK is rooted at ZIP-32 `m/32'/coin_type'/account'`. Nothing
  below that level reaches sideways to another account.

**Accepted cost**: every wallet's *decrypted* shielded transaction history now
lives in one file. It does not affect fund safety, and it is all local to one
app on one device, but it is a consolidation we chose rather than one the user
asked for. If wallet-level isolation is ever required, this is the decision to
revisit — it was weighed, not overlooked.

**Consequence for deletion**: removing a wallet or account can no longer be a
database delete. GC (D5) deletes the *account* via `delete_account`, and only
drops the database when its last account is gone.

### D15 — Sync progress is per-wallet; per-account completeness is derived, not stored

**Decision**: keep the official schema untouched. `WalletSummary` reports
balances per account but `fully_scanned_height` and `progress` per wallet, and
that is left as-is. Per-account completeness is *derived* on read from the
account's birthday plus the wallet's remaining scan ranges, exposed as
`accountSyncStatus`.

**Why**: there is no per-account scan cursor to add without owning the storage
layer again, which is exactly what D12 and the move off `zcash_client_memory`
exist to avoid. Deriving it costs one read and no schema change. Without it,
adding a new account would make every existing account look unsynced, because
the only progress number available is wallet-wide.

**Shape**: block heights only — `{ birthdayHeight, chainTip, scannedToHeight,
remainingBlocks, isComplete }`. No percentages: the denominator is note counts
in a moving window, so it never settles at 100% and reads as broken.

### D16 — Spending is gated by the proposal, not by a progress threshold

**Decision**: do not hand-roll a "synced enough to send" threshold. Let
`propose_transfer` refuse — it returns `ScanRequired` when the wallet genuinely
cannot build a transaction yet. Alongside it, show a dialog while
`accountSyncStatus.isComplete` is false, warning that the balance may be
incomplete and the send may fail, and let the user proceed.

**Why**: `Progress` documents itself as display-only ("should only be used to
compute progress percentages for display"), so using it as a safety gate
misuses it. Meanwhile an incomplete backfill understates the balance rather
than corrupting it — earlier receipts simply have not been found yet — so
blocking outright would strand users behind a long first sync for a risk the
proposal layer already catches.

### D17 — Receive addresses are one per pool kind, never a mixed UA

**Decision**: the SDK exposes addresses as a *list*, one entry per kind — a
shielded address and a transparent address today. The shielded UA is
`Require-Orchard + Omit-Sapling + Omit-P2PKH`. The app's token detail screen
shows every entry the SDK returns.

**Hardware alignment (resolved 2026-08-27)**: current firmware derives its UA
as Orchard + P2PKH (proven by ZIP-316 decoding of firmware output in
`zcash-keys-runtime` `hardware_parity_vectors`), which would make the app and
the device screen show different strings for the same account. Ruling: the
firmware ALIGNS TO THIS DECISION (drops the P2PKH receiver; owner will drive
the change), and hardware accounts adopt the Ledger display model — the app
never derives the display address for a hardware account, it asks the device
(`getShieldedAddress(path, display)`-style, single source of truth); app-side
derivation remains test-only. Re-paste parity vectors when the firmware
change lands.

Industry evidence (Ledger's own source, LedgerHQ/ledger-zcash-utils
`crates/zcash-crypto/src/keys.rs` `orchard_address_from_ufvk`): their
Receive-modal address is built as `UnifiedAddress::from_receivers(
Some(orchard), None, None)` at fixed diversifier 0 — Orchard only, no
Sapling, no transparent, no rotation. Matches this decision exactly.

**Supersedes** the `Require-Orchard + Omit-Sapling + Require-P2PKH` choice
recorded in `docs/01` (fork commit `9a0a9f8`): that address still advertises a
transparent receiver, which ties the user's transparent activity to their
shielded activity in one string.

**Why a list rather than a policy flag**: pools change every few years by
design (D6). A list grows by one entry when the next pool arrives; a flag or a
fixed return shape has to be redesigned.

**When a new spendable shielded pool arrives, merge it into the existing
shielded UA — do not add a separate address.** A unified address exists so the
*sender* picks the best receiver they support; publishing one address per pool
pushes that choice onto the user and leaks information, since which address you
hand out signals which pool you are steering them to. Split only on concrete
evidence of a counterparty that rejects multi-receiver UAs, and record which
counterparty. Note that this only ever applies to shielded pools: Orchard and
Ironwood have no standalone address encoding at all (`AddressKind` is
`Sprout | Sapling | Unified | P2pkh | P2sh | Tex`), so a "per-pool address" for
them is just a single-receiver UA — which is what the shielded entry already
is. Transparent is the one kind that genuinely needs its own entry, because
some counterparties only validate `t1...`.

**Why no Sapling receiver**: this wallet cannot spend Sapling (the ~50 MB
proving parameters are not shipped, and that is permanent). Advertising a
receiver we cannot act on is the same mistake `9a0a9f8` fixed — funds arrive
and can never leave. The same reasoning now excludes the transparent receiver
from the shielded address while transparent input signing is unimplemented.

**Note on addressing**: there is no Ironwood receiver typecode. A unified
address carries `P2pkh / P2sh / Sapling / Orchard` only, so the Orchard
receiver is what payments arrive through; which pool they land in is the
sender's consensus-driven choice, and post-NU6.3 that is Ironwood. "Orchard is
withdraw-only" describes the pool, not the address.

## Open questions

Genuinely undecided or unimplemented, not just "not gotten to yet" busywork:

- **Mnemonic-origin detection (D9) is built but not live-verified.**
  Statically typechecked and lint-clean (`yarn agent:check --profile
  commit`); not yet exercised end-to-end through a real onboarding flow (a
  real `generateMnemonic()` → `createHDWallet` → `WalletAdded` →
  `SimpleDbEntityZcash` round trip, then a zcash account added under that
  wallet reading the flag back). Building D9 removes the need to guess for
  the *freshly-generated* case (provably safe to skip scanning); it does
  **not** remove the fundamental cost for imports — confirmed in this
  integration's own design discussion: "check whether an address has
  history" and "scan from the earliest safe height" are the *same*
  operation for a shielded pool (no cheap indexed lookup exists), so an
  imported seed's birthday will always be either a real full scan or a
  value the user supplies.
- **The TokenDetails pool-breakdown UI (D10, balance breakdown, shield
  button, sync progress, birthday edit control) is written and statically
  verified but not live-verified in a browser.** CLAUDE.md requires running
  UI changes before calling them done; this integration's own live-testing
  session hit an unrelated environment problem first (see below) and was
  paused before completing that step. A `/code-review` pass on the
  uncommitted diff (2026-08-17) found and these fixed the same day:
  `getLocalWalletBalance`/`getLocalWalletSyncProgress` used `this.accountId`
  instead of their `accountId` param, which is always `''` on the
  `getChainOnlyVault` path `ServicePrivacyChain` actually calls them
  through (`VaultFactory.ts`) — the balance block could never have rendered
  anything, in any environment, until this was fixed; the birthday dialog's
  mode toggle really was plain closure variables with no re-render (fixed by
  giving the dialog content its own component with real `useState`, bridged
  to the imperative `onConfirm` via a plain mutable ref object); the
  birthday inputs had no NaN guard against non-numeric input; and the
  sync-progress poll had no `isZcash` gate on its own `pollingInterval`, so
  it would have polled forever on every non-zcash TokenDetails page too.
  Still not live-verified after these fixes — the underlying browser
  session was never completed (see below).
- **A CDP-based live-verification session on 2026-08-17 connected to the
  wrong Electron instance for several checks** (a same-machine, differently
  named worktree's dev app happened to be listening on the same debug port)
  before the mismatch was caught — no conclusions from that session about
  UI behavior or balance state should be trusted; it needs to be redone
  against a confirmed-correct instance.
- **The same 2026-08-17 `/code-review` pass surfaced additional gaps.** The
  wallet-removal listener, purge-vs-in-flight use-after-free, and 50-row
  history truncation findings from that pass are now resolved. Remaining
  independent work: `settings.ts` never disables the BTC-inherited
  `publicKeyExportEnabled`/`supportExportedSecretKeys`, so "Export Private
  Key" silently exports only the transparent half of the wallet with nothing
  telling the user their shielded funds aren't covered; `verifyMessage` and
  `signMessage` aren't overridden and inherit BTC-shaped code that breaks on
  a real zcash address/account (currently dormant — no live path reaches
  either); the zcash branch of the "All Networks" aggregated history view
  never sees local zcash history since `vaults/impls/all/Vault.ts` doesn't
  override `fetchAccountHistoryFromLocal`; `zcashWebSdk.ts`'s `walletPool`
  has no eviction, so every account viewed in a session keeps its wasm
  wallet resident in memory indefinitely; and several zatoshi↔ZEC
  conversions (including this session's new `TokenDetailsZcashPoolBlock.tsx`)
  hand-roll `BigNumber.shiftedBy` instead of using the shared
  `chainValueUtils` helper other chains (including kaspa) use for the same
  operation. None of these block what this session shipped; each is a
  real, independent fix for whoever picks it up next.
- **The `Note not found` sync-blocker bug is under active investigation as
  of this writing.** `put_blocks` throws inside one of
  `mark_sapling_note_spent` / `mark_orchard_note_spent` /
  `mark_ironwood_note_spent` during a small re-verify scan range, and — because
  the scan queue doesn't advance past a range that threw — sync gets stuck
  retrying the identical range indefinitely rather than ever reaching the
  chain tip. Diagnostic logging (pool + nullifier + cross-pool nullifier
  listing, to specifically test a receive/spend pool-tagging mismatch
  hypothesis) has been added and shipped; which pool is actually at fault is
  not yet confirmed. Whatever the fix turns out to be, it belongs as a new
  entry in `docs/04` once root-caused, and this line should be deleted once
  that lands.
- **Native mobile sync module (D2) is designed but not implemented** — no
  Kotlin/Swift code has been written yet, only the JS-side proposed surface
  (`initSyncWithUfvk`, `getBalance`, `getTransactions`, `proposeTransfer`,
  `buildUnsignedPczt`, `applySignatures`, `broadcast`).
- **Both hardware signing paths (`docs/03`) are unimplemented and partly
  unverified.** OneKey's own path is blocked on an `hd-core` SDK bump +
  firmware. The third-party Trezor path's premise (existing Orchard shielded
  firmware support) has not been re-checked against current Trezor
  documentation during this integration's work and should be before any
  implementation starts there.
- **Backend prerequisites this integration doesn't own**: a Zcash Blockbook
  upstream for transparent indexing, and a lightwalletd gRPC-web proxy for
  shielded sync (currently pointed at a third-party-hosted proxy for
  development).
- **Sapling-spend recovery path** (`docs/01`'s three options — runtime
  param download, bake params back in, or guide the user to migrate via
  another wallet first) has not been decided; no user with a real spendable
  Sapling balance has been the forcing function yet.
- **The diversifier-index `UnifiedAddressRequest` mismatch** (`docs/04`) is
  known and latent but not fixed — the two call sites should converge on one
  preset.
