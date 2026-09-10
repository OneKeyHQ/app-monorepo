# Protocol & pools

What Zcash's shielded pools actually are, how a transaction is built in each,
how balance and history get computed client-side, and the address/fee
mechanics around them. This is protocol-level reference material — it should
stay true regardless of how our own vault/SDK code evolves. Where a claim is
tied to our specific vendored code (not just the protocol), the file/function
is named so it can be re-verified against current source.

## The three pools

Zcash has shipped three shielded pool designs. All are still live in some
form; only one is currently the right *target* for new funds.

| Pool | Circuit | Trusted setup | Status (as of NU6.3) |
|---|---|---|---|
| **Sapling** | Groth16 zk-SNARK | Yes — 2018 MPC ceremony, produces a ~50MB proving-key CRS | Legacy. Wallets keep receiving/spending capability in principle, but see "Sapling prover" below for why *this* integration can't spend it. |
| **Orchard** | Halo2 (no trusted setup) | No | **Withdrawal-only since 2026-07-28.** A soundness vulnerability was disclosed in the Orchard circuit (theoretically allowed undetectable inflation); NU6.3 responded by activating Ironwood and turning Orchard into an outflow-only turnstile so existing balances can migrate out but nothing new can shield in. |
| **Ironwood** | Halo2 (same circuit family as Orchard, formally verified fix) | No | **Current shielded target.** Activated at NU6.3 (mainnet height 3,428,143, 2026-07-28). |

### Ironwood is "Orchard with a different tag," not a new crypto primitive

This matters a lot for how much new code an Ironwood integration actually
needs. Confirmed directly against upstream `zcash_client_backend` /
`orchard` source during this integration's Ironwood work:

- `wallet::Note::Orchard` is `Orchard { note: orchard::Note, pool:
  orchard::ValuePool }` — Orchard and Ironwood notes are the *same Rust type*,
  distinguished only by the `orchard::ValuePool::{Orchard, Ironwood}` tag
  carried alongside the note. There is no separate `ironwood::Note` type.
- `WalletIronwoodSpend<AccountId>` / `WalletIronwoodOutput<AccountId>` are
  literal type aliases to `WalletOrchardSpend<AccountId>` /
  `WalletOrchardOutput<AccountId>` (`WalletSpend<orchard::note::Nullifier,
  AccountId>` and `WalletOutput<(orchard::note::Note, orchard::ValuePool),
  orchard::note::Nullifier, AccountId>` respectively).
- The circuit itself needs an explicit version at proving-key build time:
  `orchard::circuit::{ProvingKey,VerifyingKey}::build()` takes an
  `OrchardCircuitVersion` (`InsecurePreNu6_2` / `FixedPostNu6_2` /
  `PostNu6_3`). Ironwood = `PostNu6_3`, which additionally enforces
  `disableCrossAddress` (part of the soundness fix).
- What *does* change: the note-plaintext encoding. Orchard uses note
  plaintext **v2**; Ironwood introduces plaintext **v3** (ZIP 2005 — adds
  post-quantum-motivated fields). This is carried as
  `orchard::note::NoteVersion::{V2, V3}` and is decoded via a distinct note
  *encryption domain* (`IronwoodDomain` vs the Orchard domain) — the trial-
  decryption step during scanning must pick the right domain per pool, but
  the underlying Pallas/Halo2 math is identical.

Practical consequence: an Ironwood wallet is architecturally "the Orchard
wallet, plus a second pool tag threaded through every match arm and a second
note-encryption domain to try during scanning" — not a new proving system,
new key hierarchy, or new signature scheme. See `docs/05` for how this shaped
the decision to add Ironwood receive/balance support without a dedicated
commitment tree.

### `ShieldedPool` enum

`zcash_protocol::ShieldedPool` has three variants: `Sapling`, `Orchard`,
`Ironwood`. The older `ShieldedProtocol` name is now a `#[deprecated]` alias
for the same type — some upstream call sites and our own vendored proto
schema (`proto/primitives.proto`, `PoolType`/`ShieldedProtocol` protobuf
enums) still use the old name; treat `ShieldedPool` and `ShieldedProtocol` as
the same three-way enum throughout this codebase and upstream.

## How balance is computed

`zcash_client_backend::data_api::AccountBalance` (upstream type, not
vendored) already carries all three pools as first-class fields:
`sapling_balance`, `orchard_balance`, `ironwood_balance`, each a `Balance`
(spendable / change-pending / value-pending breakdown), already summed
correctly into `total()` / `spendable_value()`. There is no upstream gap here
— an integration only needs to *populate* `ironwood_balance` from its own
storage, which is a matter of tagging received notes by pool correctly (see
`docs/05` for the exact vendored-crate change).

Balance summing reads a **flat table of received notes** (`received_notes` in
our vendored `zcash_client_memory`), not the commitment tree. The tree
(`ShardTree`, one per pool) exists for a different purpose: producing merkle
witnesses so a *spend* can be proven against the correct anchor. Confirmed by
walking `wallet_commitment_trees.rs`: the trait's Ironwood-specific methods
(`with_ironwood_tree_mut`, `put_ironwood_subtree_roots`,
`get_ironwood_subtree_root`) all have documented, valid no-op default
implementations upstream (`Ok(None)` / `Ok(())`) — "this backend does not
track an Ironwood tree" is an explicitly legitimate state, not an error.
Receiving funds and displaying balance never touches the tree; *spending*
from a pool without a populated tree would fail (no witness to prove
against). This asymmetry — cheap to receive/show, requires more work to
spend — recurs for every pool in this integration and is why "receive +
balance" and "spend" are tracked as separate milestones throughout these
docs.

## How a shielded transaction is built: PCZT

Zcash's analogue to Bitcoin's PSBT is **PCZT** (Partially Created Zcash
Transaction). It is the interchange format for building a transaction across
multiple untrusted or air-gapped parties — exactly the shape needed both for
our own carrier/keys-wasm split (`docs/03`) and for hardware signing.

The `pczt` crate (part of `librustzcash`) defines these roles as **separate,
independently feature-flagged** participants:

- **creator** — starts the PCZT from a `Proposal`.
- **constructor** — fills in inputs/outputs.
- **io_finalizer** — locks the input/output set.
- **updater** — attaches non-essential metadata (memos, etc.).
- **prover** — attaches zk-proofs. Needs the **proving key**, not the
  spending key — this is the role that can run in an untrusted or merely
  "has compute" environment.
- **signer** / **low_level_signer** — attaches signatures. This is the *only*
  role that needs the spending key. `low_level_signer` exists specifically
  for external signers (hardware wallets) that don't want the full
  `signer` role's assumptions.
- **spend_finalizer** — assembles final spend descriptions once all
  signatures are present.
- **tx_extractor** — produces the final, broadcastable transaction.
- **combiner**, **redactor**, **verifier** — merge partial PCZTs, strip
  sensitive fields for logging/display, and sanity-check a PCZT,
  respectively.

This role separation is not a theoretical nicety we're relying on — it's
already load-bearing in production: `zcash-android-wallet-sdk`'s Keystone
(hardware) integration uses exactly `createUnsignedTransferPczts` (creator +
constructor) → `addProofsToPczt` (prover, caching the Orchard proving key) →
external signer → `apply_batch_signatures` (signer + finalizer + extractor).
Our own carrier/keys-wasm split (`docs/03`) mirrors this same seam.

### Where our pool support currently sits on this pipeline

- **Sapling**: view-only. Prover role unavailable (see below) — can appear in
  balance/history, cannot be spent.
- **Orchard**: full round-trip historically worked pre-turnstile; now
  withdrawal-only at the protocol level regardless of our own code.
- **Ironwood**: creator/constructor/prover/signer/tx_extractor all function
  (it's the Orchard circuit under a new tag, and our proving setup already
  targets `PostNu6_3`) for the *transparent + shielded-receive* surface this
  integration currently ships. Send-from-Ironwood is not yet a verified,
  tested path end-to-end — see `docs/05`'s open items.

## Why Sapling is view-only in this integration

Sapling's Groth16 circuit needs its trusted-setup **proving key** to
construct a spend or output proof — unlike Orchard/Ironwood's Halo2, which
needs no such file. That proving key (`sapling-spend.params` ~47.7MB +
`sapling-output.params` ~3.6MB, from the 2018 Sapling MPC ceremony) was
baked directly into the original WebZjs wasm binary, accounting for the bulk
of a 57MB artifact. Our fork strips it (57MB → 7.2MB, commit `3bbe1ce`):

- **Unaffected**: Sapling key derivation (the UFVK still contains a Sapling
  FVK component), scanning/balance/history, and *receiving* to a Sapling
  receiver.
- **Lost**: the ability to spend a Sapling note — no proving key means no
  spend proof. "Can see it, can't spend it."
- **A real gap this created and closed**: for a while the wallet's advertised
  unified address still offered a Sapling receiver (so someone could send
  Sapling funds to an address whose Sapling half we could never spend from).
  Fixed in fork commit `9a0a9f8` — `get_current_address` now derives via
  `Require-Orchard + Omit-Sapling + Require-P2PKH`, so new addresses never
  advertise the receiver we can't act on.
- **Future options if Sapling-spend is ever needed** (e.g. a restored wallet
  with real Sapling balance): (a) fetch the params file at runtime instead of
  embedding it — avoids the wasm bloat but requires hosting/downloading
  ~50MB; (b) bake it back in — simplest, reverts the size win; (c) point the
  user at another wallet (Zashi/YWallet) to migrate Sapling funds into
  Orchard/Ironwood first, then continue in ours — no code change, and
  arguably the most honest option since Sapling is a sunsetting pool
  network-wide regardless of what any single wallet does.

## How history is parsed

A wallet transaction's shielded side is read off `WalletTx`'s per-pool spend
and output iterators — `sapling_spends()`/`sapling_outputs()`,
`orchard_spends()`/`orchard_outputs()`, `ironwood_spends()`/
`ironwood_outputs()`. These are already **wallet-scoped** by the time our
storage code sees them (confirmed against upstream `zcash_client_backend`
source) — the backend has already matched nullifiers/notes against this
wallet's own viewing keys; storage code doesn't need to (and shouldn't)
re-filter by "is this ours."

Per transaction, spends are marked against previously-received notes
(nullifier → note lookup in the flat `received_notes` table) before that same
transaction's own outputs are inserted — spends can only ever reference notes
received in *earlier* transactions, so this ordering is safe. Memos are
decrypted and attached by `NoteId` (`(TxId, pool, output_index)`) when
present.

The **transparent** side of history is ordinary UTXO tracking — inputs/
outputs on t-addresses, no decryption involved, just KeyScope tagging.
Because a Zcash account's viewing key is unified (t + shielded), a single
sync naturally produces both — `getHistory` in our SDK (`docs/03`) returns
transparent and shielded entries through the same call, distinguished only by
`valueZat` sign (spent vs received) and, upstream, by pool — though the pool
tag isn't currently surfaced to the app's own history item shape.

## Addresses

- **Unified Address (UA)**: a single address string encoding multiple
  "receivers" (one per pool the wallet advertises, plus optionally a
  transparent P2PKH receiver). Which receivers get included is controlled by
  a `UnifiedAddressRequest` (`Require`/`Allow`/`Omit` per receiver type) at
  derivation time. See `docs/05` for a real, currently-latent bug class here:
  two different call sites in this integration (`webzjs-keys`'s displayed
  address vs `zcash_client_memory`'s `Account::new()`) use *different*
  `UnifiedAddressRequest` presets, which can produce different transparent
  addresses for the same account under the right diversifier-index
  conditions.
- **Transparent (t-address)**: `t1…` (P2PKH) / `t3…` (P2SH), 2-byte version
  prefix — see the main README's "Two Zcash-specific pieces" for how we
  bridge this through bitcoinjs.
- **Diversifiers**: shielded receivers support many valid addresses per
  viewing key (the "diversifier index"); this integration always uses
  diversifier index 0 / the UFVK's default address rather than exposing
  diversified addresses to the user.

## Fees

Zcash fees are **ZIP-317** ("logical action" based), not Bitcoin-style
sat/vByte. The conventional minimum is 5,000 zatoshi per logical action; a
simple transfer has 2 logical actions (one spend-side, one output-side),
giving the common-case **10,000 zat (0.0001 ZEC)** flat fee this integration
displays before `pczt_create` computes the real one (spends touching more
notes can cost more), and which also happens to equal Zcash's own
`minTransferAmount` convention. There is no user-editable fee slider — see
`docs/02` for where this is wired into `estimateFee`/`updateUnsignedTx`.
