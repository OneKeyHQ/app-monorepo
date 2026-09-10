# Zcash integration architecture

## Shared runtime

All App targets use the same Rust sources and WASM artifacts from
`app-modules/chain-runtimes/zcash`. `onekey-zcash-keys` handles derivation and
signing; `onekey-zcash-runtime` handles SQLite wallets, scanning, transaction
construction and proving. These are functional boundaries, not platform forks.
The runtime uses official `zcash_client_sqlite`; it does not use WebZjs or a
serialized `zcash_client_memory` wallet. Native Rust builds serve tests and
diagnostics, not a second App implementation.

The common `sdkZcash/sdk/workerClient.ts` transports every SDK method to
`zcashSdkWorker.ts`. The Worker owns the common TypeScript implementation,
WASM instances, database connections, scan state and lease queue. Failed calls
are never replayed automatically. Reset terminates the Worker outside its
message queue, including when synchronous WASM is stuck.

| Platform | App runtime topology | Wallet carrier |
| --- | --- | --- |
| Desktop / Web | App main and bg share one JS runtime | DedicatedWorker with a separate heap |
| Extension MV3 | UI and bg have isolated heaps | Offscreen document hosts DedicatedWorker |
| iOS / Android | main and bg have isolated heaps | WebEmbed hosts an inline Blob DedicatedWorker |

On split-runtime targets the background service remains the caller authority;
UI, bg, WebEmbed/offscreen and Worker initialize independently. Bridges return
requested DTOs, deserialized in each receiving heap; they do not copy the
whole database or share JS mutexes. OPFS handles belong to the Worker and are
backed by origin-owned browser storage, not one native singleton per App JS
runtime. Native and JS release compatibility remains relevant; main and bg
bundles ship version-locked.

Mobile differs only in Worker packaging: the same entry is self-contained for
file-backed WebViews. WASM initialization is lazy, though the inline Worker
asset contains both keys and wallet modules. `inline: no-fallback` avoids a
second unused Worker artifact. Its Blob URL stays alive until termination:
WKWebView rejects OPFS access if the loader revokes the URL at construction.
Only this inline loader runtime is replaced; other Workers keep their existing
loader behavior. No COOP/COEP or SharedArrayBuffer is required.

## Storage and ownership

`simpleDb.zcash` retains viewing metadata, birthdays and scheduling state.
The Worker owns one SQLite database per network (`zcash-main.db` and
`zcash-test.db`), shared by that network's accounts. Scanned notes, transaction
facts, reservations and pending broadcast state live in SQLite. Pending send
state must not be treated as disposable scan cache.

All carriers use the same OPFS SAH-pool VFS under `.onekey-zcash-opfs`, with
page access rather than a complete IndexedDB mirror in WASM. Six initial
handles cover the two databases, rollback journals and spare files. Exclusive
SAHs prevent a second Worker from becoming another owner. Within the Worker,
SQLite connections use per-connection locks. File initialization failure closes
all acquired handles so an explicit retry can succeed.

Connections use `journal_mode=DELETE` and `synchronous=FULL`. SQLite commit
performs synchronous flushes; journal deletion also flushes its association
header before the file returns to the pool. Metadata I/O failures stop further
VFS I/O until Worker restart. The reviewed VFS patch and upstream archive
checksum are pinned in `patches/manifest.json`; vendor reconstruction rejects
drift. Browser storage policy and origin stability still govern retention.
This development change does not migrate old IndexedDB databases.

## Scanning, sending and secrets

Background services schedule bounded scan steps. The shared SDK lease covers
whole asynchronous wallet operations and database switches. Synchronous
read-only fast paths run only when the correct database and account are ready;
UI polling otherwise uses snapshots or the leased path. Network account
preparation and rescan scheduling share the existing network-level ownership.

The wallet runtime receives viewing keys. Authorized software signing sends
short-lived seed input to keys WASM; Rust/wasm cleanup does not make immutable
JS strings or bridge copies reliably erasable. Never log key material.
Transaction construction, selected-input validation, proof policy and signing
remain in their existing security boundaries. Broadcast occurs only after the
runtime's commit boundary succeeds; a failed transport never retries a send.

Orchard/Ironwood and transparent behavior is defined by the runtime and keys
capability results. Sapling is excluded by current product policy. Do not infer
hardware signing support from the software WASM path.

## Validation boundary

Use the shared Worker lifecycle tests, Rust tests, release WASM build, pinned
vendor verification and WebEmbed production checks. Carrier acceptance must
exercise actual WASM loading and OPFS persistence, not only API existence.
Crash tests should interrupt a database page write and compare recovered data
with the last committed state. Metadata write/flush failure and partial handle
acquisition require separate fault injection.

An Electron probe or one iOS simulator version does not establish Android,
minimum-iOS, extension lifecycle or funded App UI acceptance. Record the actual
platform and runtime tested, and keep those remaining checks explicit.
