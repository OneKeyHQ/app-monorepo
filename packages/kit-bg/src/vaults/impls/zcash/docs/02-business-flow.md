# Business flow

> ⚠️ **迁移说明（2026-08-23）**：本仓库已从 WebZjs fork 迁到
> `onekey-zcash-runtime`（官方 `librustzcash` + `zcash_client_sqlite` 之上的薄
> wasm 绑定层）。下列在本文件中反复出现的前提**已不再成立**，但原文保留 ——
> 记录当初为什么那样想，比一份没有历史的干净文档有用：
>
> - **COI / SharedArrayBuffer / 线程池**：新 runtime 单线程，不需要
>   `crossOriginIsolated`。Pixel 4 真机在 `crossOriginIsolated=false` 下完整跑通
>   扫链。因此 `syncWallet` 不再返回 `synced: false`，「移动端不能同步」这个前提消失。
> - **wasm 钱包状态序列化（`db_to_bytes` / blob 存 IndexedDB）**：新 runtime 用
>   SQLite 经 VFS 持续落盘，没有「快照」这个概念，相关的 revision 追踪、单飞保存、
>   purge 守卫全部不存在。
> - **每账户一份 runtime / 一份库**：见 D14，现为每 network 一库。
>
> 逐条替代决策见 `05-decisions-and-open-questions.md` 的 D14–D17。

How an account actually gets created, kept in sync, and used to show
balance/history/send — as implemented today. File/function names are cited
so this can be diffed against current code; this integration is under active
development, so treat any behavioral claim here as "true as of the commit
that wrote it," not a permanent contract.

## Account creation & the birthday problem

`KeyringHd.prepareAccounts` extends BTC's account creation, so the transparent
t-address side is created identically to any UTXO chain. It only initializes
privacy mode as off; account creation does not load the runtime or derive
shielded metadata.

`zcashDeriveAndSaveOneAccountMeta` (private, one account at a time):

1. Skip entirely if `IZcashAccountMeta` already exists with a
   `birthdayHeight`.
2. Call `api.deriveAccount(...)` (derives UFVK/UA/transparent address from
   the seed — see `docs/03`), retried up to 3 times with backoff. This
   specifically absorbs a transient gRPC-proxy error ("missing grpc-status
   trailer... possible truncation") rather than leaving the account
   meta-less over one dropped connection (see `docs/04` for the real root
   cause of that error class, since fixed).
3. Save `IZcashAccountMeta` with a stable `birthdayHeight`, its
   `birthdaySource`, and the user-supplied recovery-month timestamp when the
   account opted into privacy mode.

Privacy mode is explicit opt-in. A freshly generated mnemonic receives its
wallet-creation month as the recommended birthday. An imported mnemonic must
choose an approximate first-use month while enabling privacy. Every resolved
height is clamped to the Orchard activation floor because Sapling is outside
this integration's supported pool set.

### Manual repair actions

The recovery surface has two levels:
surfaced through `ServicePrivacyChain`
(`packages/kit-bg/src/services/ServicePrivacyChain.ts`) as the only UI door
into vault-level privacy-chain logic:

- **`retryLocalWalletSetup({password})`** — re-runs
  `zcashDeriveAndSaveOneAccountMeta` for an account whose *initial*
  derivation never completed at all (no meta, or meta without a birthday).
  Needs the seed (password-gated), goes through a full account-bound vault +
  keyring. `ServicePrivacyChain.retryLocalWalletSetup` prompts with
  `EReasonForNeedPassword.CreateTransaction` (not `Security`) specifically
  because `CreateTransaction` respects the cached-password fast path when
  `protectCreateTransaction` is off — `Security` always forces re-entry
  regardless of cache. If the wallet is already unlocked, this resolves with
  no dialog at all.
- **`repairLocalChainData`** — the one TokenDetails button combines "keep the
  saved birthday", "choose an approximate month", and "exact block height".
  It purges only the rebuildable wasm scan cache, clears the account's derived
  local-history rows, and schedules a rescan. A durable `pendingRescans`
  journal is written before changing birthday/cache state; process death at
  any intermediate point is resumed before the next scan. This is
  viewing-level only and does not unlock the wallet.

Both paths emit `RefreshTokenList` on success so the UI updates without a
manual pull.

Wired into the TokenDetails repair control (below) and the dev Gallery
debug tools `ZcashRetryLocalWalletSetupDebug` / `ZcashRescanFromDaysAgoDebug`
(`packages/kit/src/views/Developer/pages/Gallery/Components/stories/ZcashWasmGallery.tsx`).

## Sync / scan lifecycle

### Trigger points

`ServicePrivacyChain` is the only synchronization owner. It performs a
startup tick, a bounded periodic tick (30 seconds on Desktop, 3 minutes on
the suspendable targets), an immediate continuation while historic work is
queued, and an app-foreground wake. UI balance/history reads are pure reads;
they do not create competing scan jobs. Accounts sharing one seed fingerprint
are prepared together and synchronized through one shared wasm wallet.

### Single-flight guard (`zcashWebSdk.ts` `syncWallet`)

Each wallet entry (`IWalletEntry`, keyed by network+lightwalletdUrl+hdIndex+
ufvk) carries a `syncing: Promise<IZcashSyncResult> | null` field. `syncWallet`
checks it first: if a sync is already in flight, every other caller just
awaits the *same* promise instead of starting a redundant native
`wallet.sync()` call. This isn't a correctness fix (concurrent `sync()` calls
on the same Rust wallet object are safe) — it's a power/bandwidth fix: without
it, 3-4 near-simultaneous triggers each independently re-scan the same block
range.

Sync only actually runs if `canSync()` — i.e. the wasm thread pool started,
which needs `crossOriginIsolated`. Without it, sync no-ops
(`{synced: false, chainTip, fullyScanned: null}`) rather than throwing; the
caller degrades to "balance/history as of last successful sync" instead of
erroring the whole screen.

### What a sync call does

1. Open the network's runtime SQLite database and register each enabled UFVK.
2. Refresh the chain tip and required subtree roots from lightwalletd.
3. Run bounded `syncStep` calls. Product scanning keys include Orchard and
   Ironwood only; Sapling notes are not discovered, displayed, or spent.
4. Commit each completed step to the runtime database before returning its
   progress to the host scheduler.

The persisted DB is rebuildable from UFVK + birthday, so losing it cannot lose
funds. While present, it is the single source for shielded balance, history,
notes, and transaction lifecycle; those records are not copied into SimpleDB.

## Balance

`Vault.zcashGetBalanceSafe()` wraps `api.getBalance(account)` with one layer
of self-repair: on failure, it calls `tryAutoRepairLocalWalletSetupIfUnlocked()`
(`VaultBase`) — which checks `servicePassword.hasCachedPassword()` first and
only prompts if nothing is cached — and retries once if repair succeeded.
This is the *one* place that attempts recovery, rather than every caller
(periodic poll, app foreground, manual refresh) special-casing "meta might be
missing" independently. If the wallet isn't unlocked, it silently no-ops —
the account just keeps looking transparent-only until an explicit unlock.

`getBalance` in the SDK (`docs/03`) sums Orchard and Ironwood into `shielded`,
then adds transparent balance for `total`. `IZcashBalance` also carries the
three supported pool balances unsummed (`orchardBalance`/`ironwoodBalance`/
`transparentBalance`) for the TokenDetails breakdown below. Sapling is not a
product balance source and is absent from this DTO.

## History

`fetchAccountHistoryFromLocal` is the framework-level seam
(`VaultBase.fetchAccountHistoryFromLocal`, default `undefined` = zero effect
on every other chain) that lets `ServiceHistory` ask a vault for local state
*before* hitting the backend. Zcash's implementation triggers a background
sync, then calls `api.getHistory(account, {limit: 50})` and maps each
`IZcashHistoryItem` into the standard `IAccountHistoryTx` shape used
everywhere else in the app. Because the wasm wallet syncs the account's full
unified viewing key, one call naturally returns both transparent and
shielded entries. For locally sent transactions, the runtime derives the
recipient from its own transaction-output view and returns it with the history
row.

## Send

`buildEncodedTx` builds display intent only (`IEncodedTxZcash`: `zcashTo` +
`zcashAmountValue`) — real note/UTXO selection happens entirely inside the
wasm wallet, not in the app's coin-selection code. The actual PCZT lifecycle,
split across the carrier (creates + proves, watch-only) and the keys wasm
(signs, holds the spending key) is:

```
Vault.zcashCreatePczt   → api.createPczt   (carrier, watch-only wallet)
Vault.zcashProvePczt    → api.provePczt    (carrier, watch-only wallet)
KeyringHd.signTransaction → api.signPczt   (keys wasm; seed derived just for
                                             this call, wiped after)
Vault.broadcastTransaction → api.finalizePczt (durable local commit)
                           → api.broadcastPczt (network submit)
```

`KeyringHd.signTransaction` is where prove and sign are stitched together:
it calls the vault's `zcashCreatePczt`/`zcashProvePczt` (through a type-only
`IZcashVaultPcztApi` view to avoid a Vault↔KeyringHd circular value import),
derives the seed from the HD credential once, calls `api.signPczt`, then
`seedBuf.fill(0)`s it in a `finally` regardless of outcome.

`estimateFee`/`updateUnsignedTx` both return the flat ZIP-317 display fee
(`docs/01`) — there's nothing user-tunable to apply on update.

`precheckUnsignedTx` is overridden to always return `true`: the inherited BTC
precheck pulls a blockbook UTXO list that zcash's locally-served
`fetchAccountDetails` never provides, which would otherwise permanently
disable the Send button. `buildBulkSendEncodedTxs` is overridden to throw —
defense in depth alongside `nativeBatchTransferEnabled: false`, since BTC's
bulk-send builder would otherwise emit a coin-selected `IEncodedTxBtc` that
bypasses the PCZT flow entirely.

### Shield (transparent → shielded self-transfer)

A second, parallel PCZT lifecycle for the TokenDetails "Shield" button
(`docs/05` D10) — deliberately **not** the standard build/review/sign
pipeline above, since this is a one-tap action with no destination to
review:

```
ServicePrivacyChain.shieldTransparentBalance  → prompts for password, then:
Vault.zcashShieldAndBroadcast:
  Vault.zcashShieldFunds    → api.shieldFunds  (wraps wasm pczt_shield;
                                                 whole transparent balance
                                                 above dust, no destination)
  Vault.zcashProvePczt      → api.provePczt
  KeyringHd.signShieldPczt  → api.signPczt     (shares signPcztHex, the same
                                                 private helper signTransaction
                                                 uses)
  api.finalizePczt
  api.broadcastPczt
```

`shieldTransparentBalance` is the whole flow behind one `ServicePrivacyChain`
call — the UI (`TokenDetailsZcashPoolBlock`'s `ShieldButton`, below) only
shows a confirm dialog and calls it once, not a multi-step sequence.

## UI surface: TokenDetails pool breakdown

`TokenDetailsZcashPoolBlock` (`packages/kit/src/views/AssetDetails/pages/
TokenDetails/TokenDetailsZcashPoolBlock.tsx`) renders into
`TokenDetailsHeader`, right after the address block. It gates on the Zcash
implementation so it is a no-op import for every other chain, following the
same pattern as the sibling `TokenDetailsDeFiBlock`. Reads three methods from
the optional `ILocalWalletCapability`; `ServicePrivacyChain` returns typed,
discriminated DTOs because vaults are not directly callable from the UI layer:

- **`getLocalWalletBalance`** → `Vault.zcashGetBalanceSafe()` → the three
  supported pool rows. Transparent is always shown first (pairs with the
  shield button); Orchard and Ironwood remain separate so balances and source
  selection cannot leak across pool tabs. Sapling is not shown.
- **`getLocalWalletSyncProgress`** → read-only `api.getSyncProgress`; it never
  starts or joins a scan. The scheduler remains the only sync owner. The UI
  polls the shared progress DTO every 8s for the current/tip indicator.
- **`getLocalWalletAccountMeta`** → the current `birthdayHeight`, shown next
  to an "Edit" action that opens a dialog offering both a days-ago input and
  a raw block-height input (raw height, if given, wins) — same primitives as
  the manual repair actions above, just reachable from the UI now.

Dev-only feature (zcash is `SUPPORTED_IMPLS`, not `PRODUCTION_IMPLS`): this
component uses plain English strings, not `ETranslations` — matches every
other zcash-specific file in this integration, but needs real i18n before
production.

**Not yet live-verified in a browser** — see `docs/05`'s open questions for
the specific known-suspect (the birthday dialog's mode toggle using closure
variables instead of React state) and why verification was paused rather
than skipped.

## Removal / GC

`ServicePrivacyChain` listens for `EAppEventBusNames.AccountRemove` and runs
`gcRemovedAccounts()`: for every network with `vaultSettings.
localWalletSyncEnabled`, list local-wallet account ids
(`Vault.listLocalWalletAccountIds` → `simpleDb.zcash.listAccountIds()`), and
for any id with no matching DB account, call `purgeLocalWalletState` — which
frees the in-memory wasm wallet, deletes its cached DB bytes, and removes the
`SimpleDbEntityZcash` meta. The same pass also runs once, 15 seconds after
service startup, as a boot-time sweep for anything missed while the app was
closed (e.g. an account removed on another device/session before cloud sync
caught up here).
