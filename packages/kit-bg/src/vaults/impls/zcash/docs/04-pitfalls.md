# Pitfalls & debugging playbook

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

Every non-obvious bug this integration has hit, in symptom → root cause → fix
form, grouped by category. The point of this file is to stop the *next*
person (human or agent) from re-discovering these from scratch — each of
these cost real debugging time the first time.

## crossOriginIsolated / threading

### Android System WebView can never grant COI (four-way exclusion)

**Symptom**: `initThreadPool` + `sync()` fail specifically on Android inside
a `WebView`/`react-native-webview`, while the identical code with identical
COOP/COEP headers works fine in Chrome-the-app on the same device, and in
iOS `WKWebView`.

**Root cause**, established by ruling out every other explanation in order,
not by assumption:
1. Plain `http://localhost` + COI headers → `crossOriginIsolated === false`.
2. Forcing WebView command-line flags via `/data/local/tmp/webview-command-line`
   → no effect (user-build firmware doesn't read that file; `ro.debuggable=0`).
3. A clean HTTPS context (`shouldInterceptRequest` intercepting a fake
   `https://` origin, injecting COOP/COEP, no real TLS/cert involved) → still
   `false`. Ruled out "needs a real secure context."
4. The strongest form available — an app-bundled trusted CA + a real local
   HTTPS server, zero TLS errors, real `https://127.0.0.1:8443` origin → still
   `false`.

None of it worked. The conclusion, after excluding headers, HTTP-vs-HTTPS,
certificates, and secure-context status one at a time: **Android's System
WebView's process/site-isolation model itself does not grant
`crossOriginIsolated` to embedded content**, independent of anything an app
can configure. `react-native-webview` uses the same System WebView, so it has
the same ceiling.

**Fix**: GeckoView (Mozilla's embeddable engine) grants COI correctly under
the exact same conditions System WebView refuses. OneKey's Android app
already has a GeckoView escape hatch wired most of the way
(`useGeckoView` prop reaching `NativeWebView.tsx`, a currently-null-stub
module at `@onekeyhq/shared/src/modules3rdParty/geckoview`, and a commented-
out Gradle dependency) — Zcash's Android shielded scanning is the first
real consumer that needs it turned on. Cost: a real Gecko engine bundle
(~170MB in an isolated demo APK; needs evaluating in the real app bundle),
a different native↔JS message bridge (WebExtension `port`, not
`addJavascriptInterface`), and a slower cold init (~5s vs ~2s for System
WebView).

### `DataCloneError: [object WebAssembly.Memory] could not be cloned`

**Symptom**: thrown from `postMessage` inside `wasm_thread`'s worker spawn
logic, immediately on `initThreadPool`.

**Root cause**: textbook symptom of posting a non-*shared* `WebAssembly.Memory`
to a Worker. Happens whenever `crossOriginIsolated` is false (or becomes
false partway through — a stale/duplicate JS chunk from a build-cache issue
can reintroduce this even after COI is otherwise working correctly; see the
rspack cache entry below), because the wasm glue silently falls back to
non-shared memory instead of failing loudly at the point COI is actually
missing.

**Fix**: ensure `crossOriginIsolated === true` *before* the wasm module
loads at all (not just before `sync()`), and treat any recurrence of this
error as a signal to check for a stale build artifact before re-investigating
COI headers from scratch.

### `wasm_thread`'s `eval("self")` trips MV3's CSP

**Symptom**: extension MV3 context refuses to run `wasm_thread`'s worker
bootstrap — MV3 CSP disallows `unsafe-eval`, and `wasm_thread` (as vendored
upstream) calls `js_sys::eval("self")` in five places plus one unconditional
`get_worker_script()` that also evals internally.

**Fix**: vendored patch (`vendor/wasm_thread` + a Cargo `[patch]`) replacing
`eval("self")` with `js_sys::global()`, and moving the worker-script
computation into a `cfg`-gated "no-bundler" path so the eval'd branch is
compiled out entirely for the bundler target. Needs to be maintained as a
long-lived patch (or upstreamed) since it re-lands on every `wasm_thread`
version bump.

## Networking / RPC

### `tonic-web-wasm-client` 0.8.0 silently drops the gRPC trailer

**Symptom**: every unary lightwalletd call intermittently (looked
intermittent — see below) fails with *"missing grpc-status trailer... possible
truncation by a proxy or load balancer."* Easy to misdiagnose as network
flakiness or a misbehaving proxy.

**Root cause**, established by direct evidence rather than assumption: `curl`
against the exact same RPC, same server, returned fast and complete — so the
server side was never the problem. Reading `tonic-web-wasm-client` 0.8.0's
own `response_body.rs` showed `poll_frame` parsing the grpc-web trailer frame
into `self.trailer` but **never actually emitting it** via
`Frame::trailers(...)` — a real, deterministic client-library bug, not proxy
flakiness at all. (The earlier retry-loop workaround in
`zcashDeriveAndSaveOneAccountMeta`, `docs/02`, was written before this root
cause was pinned down; it still absorbs the symptom, which is now understood
to be self-inflicted rather than a real transient condition it needs to
tolerate forever.)

**Fix**: bump to `0.9.1` (contains the upstream fix), which cascaded into a
`wasm-bindgen`/`js-sys`/`wasm-bindgen-futures`/`web-sys` version-lockstep
bump (API-diffed 0.8.0→0.9.1 first to confirm no breakage). A stale comment
pinning the old `wasm-bindgen` version citing a MetaMask Snap sandbox
`encodeInto` issue was traced via `git log -S` to an unrelated upstream
commit — MetaMask's SES sandbox has nothing to do with any OneKey target;
removed rather than propagated.

### `detect_birthday_from_transparent_address` used `u64::MAX` as a range end

**Symptom**: birthday detection for a transparent address with real history
silently returned `null` instead of a height.

**Root cause**: the call used `u64::MAX` as the scan range's upper bound;
lightwalletd rejects that outright (`grpc-status 3: block range too wide
(limit 10000000)`), and the resulting error was being swallowed into `null`
rather than surfacing.

**Fix**: use the current chain tip as the range end instead of `u64::MAX`.

## Storage / sync-state

### Birthday anchored to the *succeeding* attempt, not the first one

Covered in full in `docs/02`'s "Account creation" section — included here
for the symptom side: an account created days before funding could show a
correct-looking meta record yet never see funds received in the gap, with no
error anywhere to point at. Root cause and fix: `docs/02`.

### Three cascading `todo!()`/`unimplemented!()` panics blocking transparent balance

**Symptom**: transparent balance stuck at zero despite confirmed on-chain
funds; fixing one sync error just revealed an identical-looking one at the
next call in the same chain.

**Root cause**: `zcash_client_memory`'s vendored code had three separate
placeholder panics on the same call path — `utxo_query_height` (`todo!()`),
`get_transparent_receivers`'s `include_change`/`include_standalone` branches
(`unimplemented!()`), and `put_transparent_output`'s key-scope lookup
(`todo!("look up the key scope for the address")`) — each one only became
reachable once the previous one was fixed.

**Fix**: `utxo_query_height` → real implementation (account birthday height).
`get_transparent_receivers`'s two branches → no-op `tracing::info!` (this
account model has no internal-scope or standalone addresses, so there is
nothing to add — a legitimate empty case, not a gap). `put_transparent_output`
→ `Scope::External.into()` (all of this integration's address derivation is
External scope). Verified via a real non-zero balance (`unshielded_balance:
100000` = 0.001 ZEC) actually appearing, not just a clean compile.

### Diversifier-index mismatch between two `UnifiedAddressRequest` presets

**Symptom (latent — not yet confirmed to have caused a real-world address
mismatch)**: `webzjs-keys`'s displayed transparent address uses
`UnifiedAddressRequest::ALLOW_ALL` (sapling `Allow` — never advances the
diversifier search past index 0 even if index 0 is invalid for Sapling),
while `zcash_client_memory`'s `Account::new()` uses `AllAvailableKeys`
(sapling `Require` — *will* search past index 0 if it's invalid). Traced
through `zcash_keys`' `address()`/`find_address()` source to confirm this
could produce genuinely different transparent addresses for roughly half of
all accounts (whichever fall on an index-0-invalid-for-Sapling diversifier).

**Current mitigation, not a fix**: an unconditional "legacy transparent
address" fallback (`get_legacy_transparent_address()`, using
`tivk.default_address()`, which is diversifier-search-independent) is merged
into `get_transparent_receivers`'s output regardless, so this mismatch isn't
the active blocker for anything today. Still a real, latent design
inconsistency — the two call sites should use the same
`UnifiedAddressRequest` preset.

### Ironwood fail-fast was briefly (and legitimately) checked for being a
false-positive before being trusted

Not a bug, but a worth-recording methodology note: when "Ironwood pool
support is not yet implemented" started appearing, the correct first
question was "is this misattributing unrelated activity, or is it reporting
something real?" — confirmed real only after checking that
`WalletTx::ironwood_spends()`/`ironwood_outputs()` are genuinely
wallet-scoped upstream (not block-wide) and, decisively, the account owner
confirming real ZEC actually sitting in the Ironwood pool. Treat any
"X not implemented" fail-fast the same way before either dismissing it or
building support for it — the two failure modes (misattribution vs. a real
gap) look identical from the error message alone.

### "Note not found" infinite sync retry — the cross-pool nullifier trap
(root-caused and fixed 2026-08-18, ships in wasm alpha.13)

Symptom: sync stuck forever re-scanning one block range, `WARN
mark_ironwood_note_spent: no received note matches nullifier ...` followed
by `Sync error (will be retried by caller): ... Note not found`, sync
progress reporting nulls while balances (scanned before the poison range)
still display.

Root cause was a three-part compound in our hand-patched
`zcash_client_memory` (WebZjs vendor), exposed by comparing against
`zcash_client_sqlite` in the same official RC revision:

1. **Wrong error contract.** Upstream `mark_{sapling,orchard,ironwood}_note_spent`
   return `Result<bool>` — callers offer EVERY observed nullifier
   speculatively, a miss is `Ok(false)`, never an error. Ours returned
   `Err(NoteNotFound)` on miss. The mismatch never fired pre-Ironwood
   because in-pool matches always succeeded.
2. **Split nullifier domain.** Orchard and Ironwood share one nullifier
   type, and the NU6.3 turnstile lets an Orchard-received note be spent
   inside an Ironwood bundle. Our markers filtered on the received pool's
   enum variant only, so an ironwood-bundle spend of an orchard note (our
   own earlier PCZT send!) matched nothing. The diagnostic log even printed
   the nullifier sitting in the orchard set. Both markers now match either
   variant.
3. **The send path never marked ironwood spends.** Our
   `store_transactions_to_be_sent` had no `ironwood_bundle()` branch, so a
   v6 send's spends were only ever discovered later by scanning — which
   then died on (1)+(2). All three markers now mirror sqlite's speculative
   `Ok(bool)` contract at every call site.

Method note: the fix was found by diffing our vendored store against
`zcash_client_sqlite` (the reference implementation, pinned at the same
git rev). That audit also surfaced four MORE latent ironwood gaps that
would have fired one after another the moment sync unblocked:
`scan_complete` erroring on any ironwood note position, no ironwood
commitment tree at all (received ironwood notes — including our own change!
— unwitnessable, hence unspendable), `select_spendable_notes` never
offering ironwood notes to the input selector, and no ironwood
tree/frontier persistence in the proto schema. All fixed in the same pass.
When you hand-patch a store crate, audit it against the reference store,
not against "does it compile".

## Build / bundling

### rspack's persistent build cache serving stale code across restarts

**Symptom**: `initThreadPool failed` plus what looked like two different
versions of the same code running simultaneously, *after* Rust-side fixes
that should have resolved it.

**Root cause**: `apps/desktop/node_modules/.cache/rspack` — a persistent,
intentionally-never-invalidated (`type: 'persistent'`) dev build cache —
holding a pre-fix JS bundle alongside the browser's own separate HTTP disk
cache for the same static assets. Neither layer is related to the app's own
IndexedDB wallet-data cache (`docs/02`'s sync section); don't confuse the
three when debugging "why is old behavior still happening."

**Fix**: clear the specific stale cache directory — **and only that
directory**. See the next entry for why "only that directory" is the entire
point.

### Scope discipline when clearing caches — this is a hard rule, not a style note

A cache-clearing request must be interpreted as **exactly** what was asked —
"clear the local debug npm cache and dev-server cache" means those two
things, not "enumerate and delete anything that looks like a cache." A prior
mistake in this integration's history did exactly that: an over-broad script
deleted *every* IndexedDB database in the running app, including
`OneKeyV5`/`OneKeyLocalSecretEnvelopeCryptoKey`/`WALLET_CONNECT_V2_INDEXED_DB`
— real wallet/account data, not the intended npm/dev-server cache. The
recovery process (confirm intended scope, show the exact target before
running anything destructive, wait for explicit confirmation) is the
standing rule this incident produced; it isn't specific to Zcash, but Zcash's
own wallet-cache IndexedDB store (`docs/02`) makes this integration a place
where "just clear the cache" is an especially easy phrase to over-interpret.

### `playwright-core`'s `connectOverCDP(...).close()` may close the real browser, not just disconnect

**Symptom**: a running Electron dev app the user was actively using closed
unexpectedly during CDP-based inspection.

**Status**: root cause not fully pinned down (multiple candidate mechanisms
— a very CPU-heavy concurrent build possibly triggering the app's own CPU
Watchdog, and/or one of several `browser.close()` calls across multiple
overlapping CDP client connections actually terminating the remote browser
rather than just disconnecting the local client). Recorded here as a live
risk rather than a closed bug: when connecting to an app instance the user
is actively relying on via `connectOverCDP`, don't call `.close()` on the
returned `Browser` at all unless closing the real app is the intent, and
don't run heavy concurrent CPU-bound builds (`wasm-opt -O4` alone observed
at 1000%+ CPU) alongside a live instance someone is using.

### Android `file://` cannot `fetch()` — web-embed asset loading needs a different rule than every other carrier

**Symptom**: wasm module load fails specifically on Android web-embed
(`WebEmbedApiChainZcash`, `docs/03`), while identical code works on
extension/desktop/iOS.

**Root cause**: Android web-embed serves its bundle from
`file:///android_asset/…`, and `fetch()` on a `file://` origin is
categorically disallowed — unrelated to COI/threading.

**Fix**: platform-branch the wasm-loading build rule specifically for
web-embed to `asset/inline` (base64 data URI, no `fetch()` involved) while
every other carrier keeps `asset/resource` (real fetch). Same shape as
Kaspa's existing answer to the identical constraint.

### Historical: `RealContentHashPlugin` panicked when wallet wasm was bundled in mobile

**Symptom**: production (not dev) web-embed build panics during content
hashing.

**Root cause**: the wasm glue module and its worker chunk each embed a hash
reference to the other, forming a cycle `RealContentHashPlugin` can't
resolve.

**Fix at the time**: `realContentHash: false` in the web-embed rspack config.
The mobile carrier is now keys-only, so the wallet worker cycle is absent
from current mobile output. Keep this note for Desktop/Extension packaging
work and until the compatibility setting is deliberately re-evaluated.

### `wbg` import unresolved when targeting `-t web`

**Symptom**: `Module not found: Can't resolve 'wbg'` in a real rspack/webpack
build (not `cargo`/`wasm-pack`, which don't see this).

**Root cause**: `wasm-pack build -t web` glue code imports a synthetic `wbg`
module that only the wasm-bindgen runtime provides — bundlers have no way to
resolve it as a normal JS import.

**Fix**: route `.wasm` files matching the WebZjs wasm binaries to
`asset/resource` (or `asset/inline` for web-embed, above) and explicitly
exclude them from the default `webassembly/async` rule, mirroring the
existing `canvaskit` precedent. Landed in both
`development/rspack/rspack.base.config.ts` and
`development/webpack/webpack.base.config.js`.

### `Cargo [patch.crates-io]` silently no-ops on an unsatisfiable semver

**Symptom**: 178 compile errors when bumping the vendored `zcash_client_memory`
to an Ironwood-era `librustzcash` — none of them obviously about the patch
itself.

**Root cause**: `[patch.crates-io]` only takes effect when the patch source's
own declared version satisfies the version range being patched. Patching a
crate declared as `"0.23"` with a patch source whose `Cargo.toml` says
`0.24.0-rc.7` doesn't satisfy that range — Cargo silently ignores the patch
rather than erroring, so the build proceeds against the *old* dependency
graph while the code assumes the new one.

**Fix**: switch the vendored crate's own `Cargo.toml` to direct `git + rev`
dependencies instead of crates.io versions plus a patch. No more silent
version-satisfaction failures possible once there's no version range to
(mis)satisfy.

## The wasm grpc client can hang forever on error responses

`create_account_ufvk(birthday)` fetches the server treestate at
`birthday - 1`. For birthday = Sapling activation (419200) that height has no
treestate; lightwalletd answers with a trailers-only grpc-web error frame, and
the wasm grpc client **never settles the promise**. The hung await wedged
every caller up the chain: account registration never finished, the sync
tick's single-flight guard stayed true forever, and every later tick silently
skipped — the account's wallet was simply never born (this, not scan length,
was why a floor-birthday account never showed funds under the old
per-account architecture either).

Rules that now enforce the fix, in `zcashWebSdk.ts`:

1. Registration birthdays are clamped to Sapling activation + 1 so the
   treestate request always targets an existing height.
2. **Every wasm call that reaches the network goes through `withTimeout`**
   (`get_latest_block`, `sync_step`, `create_account_ufvk`, `pczt_send`,
   chain-tip probe). A hang becomes a thrown, logged, retryable error.
3. The background tick races each account's sync against its own timeout, so
   no single account can freeze the scheduler.

When adding a new wasm call that talks to lightwalletd, wrap it in
`withTimeout` — an unsettled promise here is not a slow call, it is a
permanent silent wedge.

## Duplicate ("ghost") wasm accounts on re-registration

`MemoryWalletDb`'s `new_account` does no duplicate check: registering the
same (seed fingerprint, hdIndex) twice creates a second wasm account with a
new id. Both decrypt the same notes — no fund loss, but doubled scan work and
a ghost forever embedded in the cache blob. The only path there was the
hdIndex→id map failing to persist while a later blob save succeeded (the map
write used to swallow IndexedDB errors silently). Registration now verifies
the map write and, on failure, drops the live pool entry and throws — the
next sync rebuilds from a cache that contains neither the account nor the map
entry, so re-registration is clean by construction.
