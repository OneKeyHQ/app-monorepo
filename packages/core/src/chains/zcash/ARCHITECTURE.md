# Zcash integration architecture

Why the Zcash integration is shaped the way it is. Code is the reference for
details; this file records only what the code cannot explain by itself.

## Architecture

### Runtime split

Two WASM packages built from the same Rust sources serve every target:

- `onekey-zcash-keys` — UFVK construction and signing from account-scoped
  keys (Orchard spending key, transparent account xprv). It never receives
  the seed; it has no networking and no wallet database.
- `onekey-zcash-runtime` — wallet database, scanning, proposal/PCZT
  construction, proving and broadcast. It only ever sees viewing keys (UFVK).

Both run in one dedicated Worker per process. `sdkZcash/sdk/workerClient.ts`
forwards every SDK method to `zcashSdkWorker.ts`, which owns the WASM
instances, database connections, scan state and leases. Failed calls are never
replayed automatically. Reset terminates the Worker from outside its message
queue, because a stuck synchronous WASM call cannot receive another message.

| Platform | JS runtime topology | Wallet carrier |
| --- | --- | --- |
| Desktop / Web | `main` and `bg` share one JS runtime | Dedicated Worker with its own heap |
| Extension MV3 | `main` and `bg` have isolated heaps | Offscreen document hosts the Worker |
| iOS / Android | `main` and `bg` have isolated heaps | WebEmbed hosts an inline Blob Worker |

On split-runtime targets `bg` is the caller authority; UI, `bg`, the
offscreen/WebEmbed host and the Worker initialize independently and must not
assume each other's readiness. Bridges carry DTOs that are deserialized once
per receiving heap; they never copy the database or share JS mutexes.

### Storage

- App simpleDb: `privacyChainState` holds account intent (Privacy Mode),
  birthday, the enable/disable and rescan journals and the cached addresses;
  `privacyChainKeys` the UFVK; `privacyChainJournal` the transparent pending
  transactions. These are the recovery source of truth. `privacyChainCache`
  holds disposable saved balances and tips, each tied to the account epoch.
- Runtime SQLite (Worker): one database per network (`zcash-main.db`,
  `zcash-test.db`) shared by every registered account, on an OPFS SAH-pool VFS
  (`.onekey-zcash-opfs`). Exclusive handles prevent a second Worker from
  becoming owner. `journal_mode=DELETE` + `synchronous=FULL`, so a commit is
  durable when it returns; `secure_delete=ON` overwrites freed pages.
- Scan state is rebuildable from UFVK + birthday. Stored shielded sends in the
  same database are not; user-requested deletion still removes them.

### Data ownership

| Data | Owner | Why |
| --- | --- | --- |
| Transparent balance, UTXOs, history, broadcast | OneKey backend | Asking a lightwalletd node would reveal every transparent address to it |
| Orchard/Ironwood balance, notes, history | Local runtime scan | No server can see shielded funds without the viewing key |
| Spendability of private funds | Runtime | It selects the notes; any other source can light up a Send that then fails |
| Account intent, birthday | App database | Product state; the runtime holds no second enable flag |

Each scan call passes the exact active UFVK set; the runtime builds
trial-decryption keys only for that set.

### History ownership: decided by the transparent leg

Ownership follows visibility, not privacy. A transaction with a transparent
leg (pure transparent or mixed) is indexed by the backend, so the backend row
is the row, including Failed/Dropped; the runtime only attaches the shielded
pools the indexer cannot see. A fully shielded transaction never appears in
the index, so backend silence means "unknown", not "failed", and the runtime
owns its lifecycle alone. Rows merge by txid. Generic SimpleDB history stores
only transparent-only rows; private and mixed rows stay in the runtime.

### Sending and PCZT signing

PCZT is the only boundary between key-holding and non-key-holding code:

```
Software:  pcztCreate -> pcztProve -> keys.sign -> pcztCombine -> pcztSubmit
Hardware:  pcztCreate -> redact -> device signs -> pcztCombine -> pcztProve -> pcztSubmit
```

- Hardware gets a redacted copy of the unproved PCZT (no Sapling data, no
  proving fields; signing needs neither). The device returns signatures only;
  combining them into the local original restores what proving needs.
- Transparent-source sends use a stateless path: the keys package builds and
  signs from backend UTXOs; a UA recipient may load the proof computation
  module, but never opens the wallet database or starts scanning. Change goes
  to the account's receive t1 at `m/44'/133'/a'/0/0`. Pending transparent sends
  are reconciled by normal history refresh, not while building another payment.
- Broadcast lifecycle: building locks no notes; the runtime stores the
  finalized transaction before broadcasting, and the stored transaction holds
  its notes until mined or expired. Storing is refused if another live stored
  transaction already spends one of the same notes. Accepted or already-known =
  pending. Unknown network outcome = pending; it is never resubmitted, and is
  either mined or expires (notes released after expiry). Only an explicit node
  rejection is recorded (`ext_onekey_tx_state`); its notes stay held until
  expiry. A mined observation always wins over a rejection marker.
- Submission always extracts and stores the current signed transaction. A
  shared nullifier indicates conflicting inputs, not an identical payment;
  it cannot substitute another stored transaction for the current one.
- An unclear outcome is never rebuilt or re-signed: that could select
  different notes and pay twice.

### Scheduling

`ServicePrivacyChain` is the only sync owner. Runtimes never start network or
scan work on their own. Each `syncWallet` call bounds itself (batch count
plus a wall-clock budget in the Worker) so it cannot outrun the watchdog; the
shared `runBoundedSyncTurn` (`syncTurn.ts`) is for chains that only expose a
step primitive (XMR). UI reads return the last snapshot instead of joining a
scan.

## Key decisions

- **One WASM implementation for keys/signing on every platform**: one audited
  signing surface, and no SDK that requires the raw seed.
- **The seed never leaves the background**: account keys are derived in
  background TS; WASM gets one account's keys, the networked runtime only
  viewing keys.
- **Official `zcash_client_sqlite`**: upstream owns note selection, fees,
  anchors and witnesses; no hand-maintained wallet store.
- **Policy in TypeScript, primitives in Rust**: change pool, confirmations,
  dust, padding and spend source come from the host.
- **One database per network for all accounts and seeds**: each block is
  downloaded and trial-decrypted once; note selection is account-scoped.
- **Account removal deletes the account, not the file**: the file goes with
  its last account.
- **Privacy Mode is opt-in per account**, capped at `maxEnabledAccounts` (5);
  Transparent Mode loads no wallet runtime.
- **Birthday is chosen at month precision when enabling**, floored at Orchard
  activation, and survives pause and local-data deletion.
- **Sapling is unsupported but not forked out**: its proving parameters are
  not shipped and the runtime omits Sapling scanning keys.
- **Receive, output and spend pools are separate policies**: receive UA
  carries Orchard; new outputs, change and Shield All land in Ironwood;
  Orchard and Ironwood are spend sources.
- **Receive addresses are one UA plus one transparent address**: software
  accounts derive an Orchard-only UA; hardware accounts show the UA the device
  returns and keep the app's derivation beside it.
- **One payment source per send**, chosen on the send page; TEX recipients
  (ZIP-320) accept transparent sources only.
- **Shield All is explicit only**; enabling Privacy Mode never broadcasts.
- **Spending is gated by the proposal, not a progress threshold**: the runtime
  refuses with `ScanRequired`. Progress is display-only: a percentage and ETA
  during backfill, block heights once caught up.
- **No per-chain service**: `ILocalWalletCapability` plus
  `settings.localWallet`; `ServicePrivacyChain` owns scheduling, GC and UI
  entry points.
- **Turning Privacy Mode off is not deleting**: cache and birthday stay and a
  resume height is recorded; deleting local data also removes the UFVK.
- **Local lifecycle operations follow user intent**: pause, delete, cache
  reset and rescan are not vetoed by pending transactions.
- **Cellular scanning needs explicit permission** (default off).

## Glossary

- **Transparent Mode / Privacy Mode** — per-account modes. Privacy Mode means
  discovery is enabled, not that history is complete.
- **Viewing identity** — the UFVK private activity is discovered under; App
  accounts sharing one share scan state but keep independent intent.
- **Birthday** — earliest height that must be scanned to recover history.
- **Known zero** — a zero backed by complete observations; an unavailable or
  incomplete scan is never displayed as zero.
- **Unresolved outgoing transaction** — no terminal outcome yet; a missing
  network response is not a rejection, only an explicit node rejection is.

## Pitfalls

- **rayon deadlock on wasm.** Upstream `scan_cached_blocks` hands trial
  decryption to `rayon::spawn_fifo`; single-threaded wasm has no workers and
  hangs forever. The runtime loops over `scanning::scan_block` instead.
- **Node requests are relayed by the host.** WebView/Worker fetch is subject to
  CORS and origin rules, so the runtime's request handler goes through
  `hostFetchStream` (Electron main, the RN app over the WebEmbed private
  bridge, the extension service worker). Plain web needs a CORS-enabled node.
  A missing host channel must fail, not fall back to browser fetch.
- **Nodes must speak gRPC-web over HTTPS.** Native gRPC endpoints fail
  regardless of CORS, and mobile blocks cleartext HTTP.
- **OPFS needs a real origin.** `file://` is an opaque origin where OPFS throws
  `SecurityError`, so Android serves WebEmbed from a virtual https origin.
  WKWebView resolves OPFS through the Worker's Blob URL origin: do not revoke
  that URL until the Worker terminates.
- **Orchard and Ironwood share one nullifier domain.** An Orchard note can be
  spent inside an Ironwood bundle; any per-pool switch must handle Ironwood
  explicitly and must not filter spends by the received pool.
- **Treat a broadcast error as unknown, never failed.** A timeout, or even a
  4xx from the backend, can follow a successful upstream submission;
  reporting failure invites a resend from other inputs.

Generic chain-integration pitfalls (wasm carriers, registries, vault settings)
are in `.skillshare/skills/1k-feature-guides/references/rules/adding-chains.md`.
