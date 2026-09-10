# SDK integration

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

How our business logic (`docs/02`) actually reaches the WebZjs wasm engine
across every platform, and the seam that will eventually carry hardware
signing.

## The WebZjs SDK surface

Fork: `ByteZhang1024/WebZjs` (local clone alongside this repo at
`../WebZjs`), vendoring a hand-ported `zcash_client_memory` on top of
official `librustzcash` (not ChainSafe's older fork — see `docs/05` for why).
Published to npm as `@bytezhang/webzjs-wallet` and `@bytezhang/webzjs-keys`
(self-published under a personal scope; there is no upstream release to
depend on instead).

Two separate wasm modules, deliberately kept apart — this split *is* the
key/signing security boundary, not just a bundle-size optimization:

- **`webzjs-keys`** — small, single-threaded, no network. `UnifiedSpendingKey`,
  `SeedFingerprint`, `pczt_sign`. Everything that needs the raw seed lives
  only here.
- **`webzjs-wallet`** — the heavy one (`WebWallet` class): sync/scan, balance,
  history, PCZT create/prove/send. Only ever holds a **UFVK** (viewing key),
  never a spending key. Needs `initThreadPool` (rayon-backed, needs
  `crossOriginIsolated` + `SharedArrayBuffer`) for scanning; without it,
  everything except `sync()` still works single-threaded.

Desktop/web/extension use
`packages/core/src/chains/zcash/sdkZcash/sdk/zcashWebSdk.ts`; the mobile
web-embed uses the deliberately separate keys-only `zcashKeysWebSdk.ts`.
Both expose the same `IZcashSdkApi` bridge shape, but wallet-side methods fail
closed in the mobile carrier until the native scanner exists. The full API is:
`smokeTest`,
`getChainTip`, `deriveAccount`, `deriveAddressFromUfvk`, `signPczt`,
`syncWallet`, `getBalance`, `getHistory`, `getPendingBroadcasts`,
`createPczt`, `shieldFunds`, `quoteShieldFunds`,
`provePczt`, `finalizePczt`, `broadcastPczt`, `purgeWallet`. Every value
crossing this API is JSON-safe (hex/decimal strings, no `bigint`, no wasm
objects) — required because two of the three carriers below marshal calls over
a serialization bridge.

## The three-carrier platform pattern

`zcashWebSdk.ts` needs a real browser-like JS environment with a DOM/Worker
global (for `initThreadPool`'s rayon workers) — that doesn't exist in every
runtime OneKey ships to. This is the same problem Kaspa's wasm SDK solved
first; Zcash's carrier wiring is a direct copy of that precedent, not a new
pattern:

| Platform | Carrier | Why |
|---|---|---|
| Desktop / Web | Direct — background JS runtime already has a proper window/Worker environment | No bridge needed |
| Browser extension | **Offscreen document** (`chrome.offscreen.createDocument`) | MV3 background service workers have no DOM/Worker; the offscreen document does. Confirmed by direct testing that MV3's manifest-level `cross_origin_embedder_policy`/`cross_origin_opener_policy` keys extend to offscreen documents (not just visible tabs) — offscreen gets real `crossOriginIsolated`/`SharedArrayBuffer`, so threaded scanning works there. |
| iOS / Android (native) | **keys-only web-embed** — a hidden WebView loading the small signer/deriver WASM | Hermes cannot run WASM. The system WebView can run the single-threaded keys module, but cannot provide the COI/threading required by the wallet scanner. The wallet module is excluded at build time. |

Per-platform entry points follow the same suffix-resolution convention as
every other multi-platform SDK in this repo (`index.ts` / `index.web.ts` /
`index.ext-bg-v3.ts` / `index.native.ts` under `sdkZcash/sdk/`), resolved by
`development/rspack/utils.ts`'s `createResolveExtensions` based on target +
MV3 + background-vs-not.

### Extension: offscreen registration

Three-file registration triple (same shape every offscreen-backed chain
uses — **all three must be updated together**, missing the third is a
known trap that silently leaves the UI reading `undefined`):

- `packages/kit-bg/src/offscreens/instance/IOffscreenApi.ts` — adds
  `zcashSdk: OffscreenApiZcashSdk` to the interface.
- `packages/kit-bg/src/offscreens/instance/offscreenApi.ts` — `case
  'zcashSdk': return new (await import('../OffscreenApiZcashSdk')).default()`.
  addresses the actual module.
- `packages/kit-bg/src/offscreens/OffscreenApiZcashSdk.ts` — the class,
  delegating every method to `(await zcashWebSdk.getZcashApi())`.

Calls reach it via `$offscreenApiProxy` (`shared/src/appGlobals.ts`, set up
in `apps/ext/src/entry/background.ts`) → `offscreenApiProxy.ts`
(`_createProxyModule`). Two offscreen-specific traps hit and fixed during
this integration (full detail in `docs/04`): the shared `fetchInterceptor`
patches `fetch` globally (including inside the offscreen bundle, which is a
separate chunk from the main background bundle — grepping only the main
bundle for `fetch` usage misses this), and offscreen must never load
`kit-bg`'s *full* `updateInterceptorRequestHelper()` (it waits on a
jotai-storage-ready signal that offscreen never emits).

### Native: web-embed registration

Same three-file shape, mirrored for the webembed bridge instead of
offscreen:

- `packages/kit-bg/src/webembeds/instance/IWebembedApi.ts` — `chainZcash:
  WebEmbedApiChainZcash`.
- `packages/kit-bg/src/webembeds/instance/webembedApi.ts` — `if (name ===
  'chainZcash') return new (await import('../WebEmbedApiChainZcash')).default()`.
- `packages/kit-bg/src/webembeds/WebEmbedApiChainZcash.ts` — the class.

Reached via `ensureWebembedApiProxyAvailable()`. The web-embed bundle itself
(`apps/web-embed`) is generic — `PageWebEmbedApi.ts` needed no Zcash-specific
change, only a rebuild (`yarn app:web-embed:build`) so its bundled output
(shipped inside the native app's assets) picks up the new chain.

`WebEmbedApiChainZcash` imports `zcashKeysWebSdk.ts`, never `zcashWebSdk.ts`.
`webzjs-keys` now derives the Orchard + transparent UA directly from the UFVK,
so account/address derivation no longer loads a throwaway `WebWallet`. The
production build runs `check-zcash-bundle-boundary.js`: any wallet marker in
web-embed or keys payload above 2.1 MB gzip fails the build. In the verified
build, removing the inlined wallet and its worker copies saved 32,575,884 raw
bytes; Zcash contributes 1,797,495 gzip bytes of keys-only output.

### Desktop COI

Threaded wasm scanning needs `crossOriginIsolated`, which needs
`Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy` response headers
on whatever page is running the wasm. On desktop this is injected in
`apps/desktop/app/app.ts`'s `session.defaultSession.webRequest.
onHeadersReceived` handler. Verified working for the main dev window; the
production recommendation (not yet done) is a **dedicated session partition**
for whatever page hosts WebZjs rather than the default session, since global
`COEP: require-corp` is invasive — it affects dApp webviews and remote image
loading elsewhere in the app if applied too broadly.

## Vault / KeyringHd seams

`VaultBaseChainOnly` exposes one optional integration point:
`getLocalWalletCapability()`. Server-indexed chains return `undefined`; a
client-scanned chain returns its complete `ILocalWalletCapability`. This keeps
privacy-chain methods out of every unrelated vault while giving
`ServicePrivacyChain` one typed boundary for scheduling and UI reads:

```
listAccounts()       — participants, physical runtime grouping, and GC scope
getChainTip()        — isolated lightweight network probe
syncGroup()          — one bounded scheduler-owned sync turn
reset()/resetCarrier() — account state and carrier lifecycle
onWalletAdded()/gcWalletState() — chain-owned persisted metadata lifecycle
getAccountMeta()/getBalance()/getSyncProgress() — typed UI reads
rescan()             — scan-start preview and repair
```

`retryLocalWalletSetup(password)` stays on account-bound `VaultBase`: it needs
the account keyring and must not be callable on the chain-only scheduler vault.

`Vault.ts` (`extends VaultBtc`) implements the capability on top of the BTC
transparent/account backbone, plus overrides `fetchAccountDetails`/
`fetchTokenList`/`fetchAccountHistoryFromLocal`/`estimateFee`/
`precheckUnsignedTx`/`buildEncodedTx`/`buildDecodedTx`/`buildUnsignedTx`/
`updateUnsignedTx`/`broadcastTransaction` to route through the SDK instead of
BTC's blockbook-backed defaults — see `docs/02` for what each of those does.
`zcashGetApi()` is the one place that imports `sdkZcash/sdk` — every other
vault method goes through it rather than importing the SDK module directly.

`KeyringHd.ts` (`extends` BTC's `KeyringHd`) owns everything that needs the
seed: shielded-meta derivation at account creation (`docs/02`) and
`signTransaction` (PCZT signing, `docs/02`'s send section). It reaches the
vault's PCZT-building methods through a **type-only** `IZcashVaultPcztApi`
view (`types.ts`) specifically to avoid a `Vault ↔ KeyringHd` circular
*value* import — the type import is fine, a runtime `import` of the sibling
class would not be.

There is deliberately **no per-chain `ServiceZcash`**. An earlier version of
this integration had one; it was removed in favor of putting all chain logic
behind the vault capability above plus one chain-agnostic
`ServicePrivacyChain` singleton (`docs/02`) that owns only what a vault
architecturally cannot: the background sync scheduler, GC, and the
UI-callable door (vaults aren't directly reachable from the UI layer). Adding
a second privacy chain later (a Monero-family chain, say) should mean
implementing the same capability + a settings flag
(`localWalletSyncEnabled`) — zero new services.

## The hardware signing seam: PCZT, both directions

`docs/01` covers PCZT's role separation in protocol terms. Two distinct
hardware integration paths both terminate on the same PCZT boundary, and
both are currently **deferred, not implemented**:

### OneKey's own hardware line

`hd-core`'s `INetwork` union has no `zec` entry yet — this is why `hw`/`qr`
keyrings are `undefined` in `Vault.ts`'s `keyringMap`. Landing this needs an
SDK bump plus firmware support. Firmware-side, the delta from an
already-scoped Orchard grant to Ironwood is understood to be small (curves,
signature scheme, and key derivation are unchanged — Ironwood reuses
Orchard's circuit per `docs/01`) — it needs parsing a PCZT's Ironwood section,
recognizing note-plaintext v3, an updated branch-ID allowlist, and migration-
transaction display/signing support. See `docs/05` for the pool-evolution
design rules this implies (negotiate supported pools with firmware before
building a proposal; never blind-sign a pool the firmware hasn't confirmed).

### Third-party (Trezor) hardware

Distinct from OneKey's own line, reached through the separate HWK stack
(`hwk-trezor-core`, not `hd-core` — see the hardware-integration memory notes
this repo's agents maintain for why HD and HWK are parallel, never-bridged
stacks). Trezor firmware is understood to already ship real Orchard shielded
signing support — **this specific claim is general Zcash-ecosystem knowledge,
not something re-verified against actual Trezor firmware source during this
integration's work**, and should be confirmed against current Trezor
firmware/SDK docs before any real implementation work starts on this path.
If accurate, the same "which pools does the connected firmware actually
support" negotiation applies here as for OneKey's own hardware — Trezor
having Orchard support says nothing about whether it has Ironwood support
without checking.

### Why both converge on PCZT

Whichever hardware path gets built first, the shape is the same: the carrier
(watch-only, holds the UFVK) creates and proves an unsigned PCZT exactly as
it does for software signing today; only the *signer* role changes — instead
of `webzjs-keys`' `pczt_sign`, an external device receives the PCZT hex,
signs offline, and returns it for `apply_batch_signatures`/broadcast. No
change to the creator/constructor/prover code path either way. This is the
same interchange already proven in production by
`zcash-android-wallet-sdk`'s Keystone integration (`docs/01`).
