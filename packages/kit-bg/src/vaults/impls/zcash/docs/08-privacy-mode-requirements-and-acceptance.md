# Zcash Transparent and Privacy Modes

Status: accepted for implementation

This document is the product and test contract for the Zcash integration. It
supersedes older assumptions that every Zcash HD account initializes and scans
a local shielded wallet automatically.

## Product modes

Every Zcash account has an independent product mode. There is no persisted
chain-wide master switch.

- **Transparent Mode** is the default. It exposes the transparent address,
  backend balance, backend history, and supported transparent sends. It does
  not derive or register a UFVK, create WalletDb state, scan compact blocks, or
  initialize the wallet runtime.
- **Privacy Mode** is opt-in. It derives and stores viewing metadata locally,
  registers the UFVK, and enables Orchard and Ironwood scanning and actions.
- The network scheduler runs only while at least one privacy identity is
  enabled. Network activity is a derived state, not a user setting.

Software HD accounts, including wallets restored from a mnemonic, may enable
Privacy Mode. Imported xprv accounts and watch-only transparent accounts remain
transparent-only in the first implementation. Hardware and single-WIF support
are future work.

## State and ownership

The App database is authoritative for account intent, birthday, viewing
metadata, enable/disable operation state, transparent pending transactions,
and transparent outpoint reservations. Missing mode state means off; this
development version has no compatibility migration.

The Rust wallet database owns only rebuildable private scan state and private
or mixed transaction lifecycle. Each scan call receives the exact active UFVK
set from the App and constructs trial-decryption keys only for that set. Rust
does not persist another product-mode flag.

The runtime deduplicates scan state by `(network, UFVK)`, while UI intent stays
per App account. Enabling one alias does not make another alias display private
data. The cache cannot be deleted while another enabled alias references it.
A watch-only account never gains private UI merely because its transparent
address matches an HD account.

Generic SimpleDB history stores only transparent-only transactions. Private
and mixed history remains runtime-owned and is never copied into that store.

## Birthday

Birthday collection occurs when Privacy Mode is enabled, not during wallet
onboarding.

- For a mnemonic created by OneKey, record the wallet creation month and offer
  it as the recommended month.
- For an imported mnemonic, the user must choose an approximate month.
- Convert the selected month to a conservative block height and persist the
  height. Do not scan earlier than the supported Orchard activation boundary.
- Pause, local-data deletion, cache reset, and re-enable retain the birthday.

An enable operation becomes on only after birthday, password-gated viewing-key
derivation, metadata persistence, and runtime registration succeed. Failure or
cancellation leaves the account off. During catch-up, private balances are
unknown rather than zero.

## Runtime loading

- Transparent balance, history, and receive do not initialize either Zcash
  WASM package.
- Transparent software signing lazily initializes only the stateless keys
  signer for the current process or WebEmbed lifetime.
- Privacy sync and private transaction work lazily initialize the wallet
  runtime.
- Closing Privacy Mode stops scheduling new bounded scan steps. An in-flight
  step may finish; the next App/background startup does not initialize the
  wallet runtime when no account is enabled.
- The async wallet asset remains in builds because users can opt in. Lazy
  execution is distinct from removing bytes from the installation package.

On iOS and Android, bg owns the persisted mode while the WASM resource lives in
main's WebEmbed. On Extension, bg service worker and offscreen runtime are
independent. Every bg boot restores mode before scheduling work. Desktop/Web
follow the same persisted contract even though the App JS runtime is single.

## Supported pools

- Sapling is unsupported: no product receiver, ownership scan, balance,
  history, or spend source.
- Orchard remains a spendable historical source.
- Ironwood is the current new shielded-output and change pool.
- The displayed private UA contains the Orchard receiver used by the protocol
  to route current payments to Ironwood; it is not an "Ironwood address".
- Shield All spends all eligible regular transparent UTXOs into the account's
  current Ironwood pool. It excludes coinbase and never runs automatically.

## Send matrix

The user selects an exact shielded source pool. Shielded pools never cross.
An account-level preference, off by default, may additionally use eligible
regular transparent UTXOs for sends to a supported shielded address. When it is
enabled, transparent inputs are selected first and the selected shielded pool
only covers a shortfall. It has no effect on transparent destinations or the
explicit transparent-only send path.

| Source | Destination | First implementation |
| --- | --- | --- |
| Transparent regular UTXO | transparent address | Supported by stateless Zcash signer |
| Transparent coinbase UTXO | any | Visible but locked; unsupported |
| Transparent | own Ironwood | Supported only by explicit Shield All after enabling Privacy Mode |
| Transparent | external UA/Ironwood | Unsupported |
| Transparent | Sapling | Unsupported |
| Orchard | transparent address | Supported by Withdraw/private runtime path |
| Ironwood | transparent address | Supported by Withdraw/private runtime path |
| Orchard | supported UA | Supported, exact Orchard input source |
| Ironwood | supported UA | Supported, exact Ironwood input source |

The App captures the account preference on the encoded transaction and passes
the same `spendTransparent` value to both the fee quote and PCZT creation. It is
true only when the preference is enabled and the destination is shielded. This
prevents a setting change during review from changing the selected inputs after
the user saw the fee.

Transparent sends use OneKey-managed Blockbook data for UTXOs, chain height,
raw previous transactions when required, broadcast, and txid status. Unknown
coinbase classification fails closed. The stateless signer implements Zcash
transaction serialization/signing and ZIP-317 fees; it does not reuse Bitcoin
PSBT signing.

Before broadcast, the App durably records selected outpoints, raw transaction,
txid, expiry, and intent. A timeout is unknown, not failed; reconciliation
queries by txid and rebroadcasts identical bytes when safe. It never rebuilds
and resigns on retry.

Coin Control is optional after the base t-to-t path is stable. Existing UI may
be reused, but selected outpoints must be revalidated and reserved, coinbase
must remain unselectable, and ZIP-317 must be recomputed by the Zcash builder.

## Pause, delete, and reset

- **Pause Privacy Mode** stops future scanning and hides private surfaces while
  retaining viewing metadata, birthday, and runtime cache.
- **Delete Local Privacy Data** is a separate destructive account action. It
  turns Privacy Mode off and deletes local viewing metadata and private cache,
  but retains birthday. Chain funds are unaffected and remain unavailable
  until re-enable and rescan.
- **Reset Runtime Cache** is a developer/recovery action. It retains account
  mode, viewing metadata, and birthday, then rebuilds scan state.

All three actions, plus birthday rescan, share one background safety gate. They
are refused while there is an active PCZT reservation, unsettled outgoing
transaction, or unresolved broadcast. The UI offers an immediate status check
and otherwise says to retry in about 15 minutes. The estimate corresponds to a
10-block lock and is not a wall-clock guarantee.

## UI and settings

When Privacy Mode is off, Orchard and Ironwood remain visible but contain no
cached balance, history, receive address, or transaction action. They show an
enable control and explain the consequences. Enabling never broadcasts or
automatically shields funds.

The first-time explanation states that local scanning consumes network,
storage, and battery; fast sync may require the App to remain open; returning
after a long inactive period can require a lengthy catch-up; viewing data and
private history stay local; and private assets remain unavailable while the
mode is off or sync is incomplete.

`Settings > Privacy Chains` owns generic cellular permission, enabled-account
summary, and local-storage information. Its Zcash section exposes developer
diagnostics only when Developer Mode is enabled. Account Settings owns the
account mode, birthday, pause, and local-data deletion.

The Zcash Transparent pool page also owns the account-level **Use transparent
funds first** preference. Its disclosure explains that a private send may put
the transparent address on-chain alongside shielded outputs and that change is
returned to Ironwood. This is opportunistic during a user-initiated private
send; it does not schedule or broadcast a background shielding transaction.

Cellular privacy sync uses one global permission, default false. Without
permission no fast or slow private scan runs on cellular. An explicit user
attempt may request permission; Wi-Fi sync remains available.

## History projection

Aggregate history contains one row per txid. Pool history includes a row only
when the transaction truly touches that account and pool, and displays that
pool's delta. A real cross-pool transaction may therefore appear in multiple
pool views. A transparent backend record cannot be assigned to Orchard or
Ironwood by heuristic.

## Acceptance gates

Deterministic automated tests are mandatory for address validation, birthday
conversion, mode transitions, enabled-UFVK filtering, Sapling exclusion,
per-pool history projection, transparent-first destination gating, quote/create
policy parity, ZIP-317 fee calculation, selected-UTXO revalidation, coinbase
rejection, concurrent-send reservation, broadcast
accepted/known/rejected/unknown handling, expiry, restart recovery, and
Pending-to-Confirmed reconciliation.

Runtime automation may use Zcash testnet directly, but the App exposes no
testnet network. Online testnet jobs are non-blocking because faucet and node
availability are external. No mnemonic or key used for funded testing is
stored or logged; only the public canonical BIP39 test-vector mnemonic may
appear in deterministic fixtures.

App acceptance uses mainnet. Extension is the primary full funded matrix.
Desktop, Extension, iOS, and Android each cover transparent Token/History,
enable and catch-up, one send, broadcast, Pending, restart, and Confirmed.
Manual funded checks cover transparent-to-transparent, Shield All into
Ironwood, Orchard withdrawal, Ironwood withdrawal, private transfer, exact
pool history, and balance/fee conservation.

Release blockers are wrong-pool selection, duplicated or cross-account
history, balance/fee mismatch, privacy data sent to the backend, ambiguous
broadcast permitting a new spend, restart losing a tx or changing txid, and an
enabled account being unrecoverable on any supported platform.

## Explicit non-goals

- App-visible Zcash testnet network.
- Sapling discovery, display, receive, or spend.
- Scheduled/background automatic shielding.
- Transparent-to-external-UA sends.
- Single-WIF imported sending.
- Hardware Zcash sending.
- Per-transaction WASM unloading.
- Compatibility migration for current development-only local data.
