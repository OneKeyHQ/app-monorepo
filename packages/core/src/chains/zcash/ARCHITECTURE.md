# Zcash integration architecture

Why the Zcash integration is shaped the way it is, and the pitfalls that shaped
it. Code is the reference for details; this file records only what the code
cannot explain by itself.

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

- `simpleDb.zcash` (App): account intent (Privacy Mode), birthday, viewing
  metadata, reservations and transparent pending transactions. This is the
  recovery source of truth.
- Runtime SQLite (Worker): one database per network (`zcash-main.db`,
  `zcash-test.db`) shared by every registered account, on an OPFS SAH-pool VFS
  (`.onekey-zcash-opfs`). Exclusive handles prevent a second Worker from
  becoming owner. `journal_mode=DELETE` + `synchronous=FULL`, so a commit is
  durable when it returns.
- Scan state is rebuildable from UFVK + birthday. Pending broadcast state in
  the same database is not: never treat it as disposable cache.

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
Software:  pcztCreate -> pcztProve -> keys.sign -> pcztSubmit
Hardware:  pcztCreate -> redact -> device signs -> pcztCombine -> pcztProve -> pcztSubmit
```

- Hardware gets a redacted copy of the unproved PCZT (no Sapling data, no
  proving fields; firmware rejects both). The device returns signatures only;
  combining them into the local original restores what proving needs.
- Transparent-source sends use a stateless path: the keys package builds and
  signs from backend UTXOs; a UA recipient may load the proof computation
  module, but never opens the wallet database or starts scanning.
- Broadcast lifecycle: the runtime stores the finalized transaction before
  broadcasting. Accepted or already-known = pending. Unknown network outcome =
  pending, rebroadcast with the identical stored bytes on sync. Explicit node
  rejection keeps the record and locks its notes until expiry. A mined
  observation always wins over a rejection marker.
- Retry never rebuilds or re-signs: that could select different notes and pay
  twice.

### Scheduling

`ServicePrivacyChain` is the only sync owner. Runtimes never start network or
scan work on their own. Each turn is bounded (`syncTurn.ts`) so it cannot
outrun the watchdog; UI reads return the last snapshot instead of joining a
scan.

## Key decisions

- **One WASM implementation for keys/signing on every platform.** One
  audited signing surface instead of per-platform reimplementations; mobile
  SDKs that require the raw seed were rejected for the same reason.
- **The seed never leaves the background.** ZIP-32 Orchard and BIP-32
  transparent account keys are derived in background TS, like other chains;
  WASM only gets one account's keys, so a compromised runtime cannot reach
  other chains. The networked runtime only ever sees viewing keys.
- **Official `zcash_client_sqlite`, no hand-maintained wallet store.** A
  hand-patched store drifted from upstream and produced consensus-adjacent
  bugs; upstream owns note selection, fees, anchors and witnesses.
- **Policy in TypeScript, primitives in Rust.** Change pool, confirmations,
  dust, padding and spend source come from the host; the runtime hides no
  defaults. Every Rust change costs a rebuild and release, and policy changes
  more often than protocol.
- **One database per network for all accounts and seeds.** Each block is
  downloaded and trial-decrypted once regardless of wallet count (battery).
  Mixing seeds is safe: note selection is account-scoped in SQL and the
  database holds no spending keys. Accepted cost: all wallets' decrypted
  shielded history lives in one local file.
- **Account removal deletes the account, not the file.** The file is removed
  only with its last account.
- **Privacy Mode is opt-in per account.** Scanning costs bandwidth, storage and
  battery. Transparent Mode loads no wallet runtime. At most 5 enabled
  accounts (`maxEnabledAccounts`): each adds a trial-decryption key checked
  against every block, and low-end devices must stay usable.
- **Birthday is collected when enabling Privacy Mode, at month precision.**
  OneKey-generated mnemonics get their creation month recommended; imported
  ones must pick a month. The floor is Orchard activation. A birthday survives
  pause and local-data deletion.
- **Sapling is unsupported, but not forked out.** Its ~50 MB proving
  parameters are not shipped, so Sapling funds could never leave; the runtime
  omits Sapling scanning keys. Removing Sapling code entirely would need a
  permanent upstream fork.
- **Receive, output and spend pools are separate policies.** The receive UA
  carries an Orchard receiver; new outputs, change and Shield All land in
  Ironwood; Orchard and Ironwood are spend sources. Ironwood has no UA
  typecode, so an address cannot tell which pool a payment lands in.
- **Receive addresses are a list: one Orchard-only UA plus one transparent
  address.** A transparent receiver inside the UA would link transparent and
  shielded activity. A future spendable pool joins the existing UA. Hardware
  accounts display the address the device derives.
- **The payment source is the send page's choice.** A payment spends exactly
  one source and never mixes transparent and shielded or two shielded pools,
  so the shown spendable amount and Max always agree. TEX recipients (ZIP-320)
  accept transparent sources only.
- **Shield All is explicit only.** It moves regular transparent UTXOs (not
  coinbase) into Ironwood; enabling Privacy Mode never broadcasts anything.
- **Spending is gated by the proposal, not a progress threshold.** The
  runtime refuses with `ScanRequired` when it cannot build; progress is
  display-only and shown as block heights, not percentages.
- **No per-chain service.** Chain logic sits behind the vault's
  `ILocalWalletCapability` plus declarative `settings.localWallet`; the shared
  `ServicePrivacyChain` owns scheduling, GC and UI entry points.
- **Turning Privacy Mode off is not deleting.** Disabling keeps cache and
  birthday and records a resume height, because the shared scan queue keeps
  advancing for other accounts and re-enable must not leave a gap. Deleting
  local privacy data also removes the UFVK (nothing on the device can read
  that history afterwards) but keeps the birthday.
- **Destructive local operations wait for pending sends.** Disable, delete,
  cache reset and rescan are refused while a reservation or unresolved
  transaction exists, so they cannot free inputs a pending transaction spends.
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
- **WebEmbed wasm is inlined.** `fetch()` cannot load `file://` assets, so the
  web-embed build uses `asset/inline` for chain wasm.
- **BigInt cannot cross JSON bridges.** Extension offscreen and WebEmbed
  messaging fail with "Could not serialize message"; desktop Worker structured
  clone works, so the bug shows only there. Keep u64 values as decimal strings
  across the SDK API.
- **MV3 background must not import a Worker factory.** rspack panics on chunk
  ids; keep the background entry (`index.ext-bg-v3.ts`) a proxy.
- **Restart the dev server after rebuilding wasm.** A running dev server then
  fails with "Cannot find module onekey-zcash-runtime".
- **`realContentHash: false`** on desktop: the wasm glue and its emitted URL
  reference each other, a cycle `RealContentHashPlugin` cannot order.
- **v6 transactions need an upgraded node.** A broadcast endpoint that predates
  the current network upgrade rejects v6 with an opaque error; check the node
  before debugging the signer.
- **Orchard and Ironwood share one nullifier domain.** An Orchard note can be
  spent inside an Ironwood bundle; any per-pool switch must handle Ironwood
  explicitly and must not filter spends by the received pool.
- **Treat a broadcast error as unknown, never failed.** A timeout, or even a
  4xx from the backend, can follow a successful upstream submission;
  reporting failure invites a resend from other inputs.
- **Two preset-network registries.** `presetNetworks.ts` has a map and a
  separate `getPresetNetworks()` array; a chain missing from the array does
  not exist in the UI while tests stay green.
- **Vault settings must be frozen.** Without `Object.freeze`,
  `getVaultSettings` throws and the `Promise.all` that loads all networks
  rejects, so every network disappears. `settings.loadable.test.ts` loads each
  chain individually.
