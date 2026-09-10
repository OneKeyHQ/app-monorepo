# ADR 0001: Zcash network identity and data ownership

- Status: Accepted
- Date: 2026-09-02

## Context

The test backend exposes mainnet Zcash as `ZEC0`, while OneKey network IDs use
the canonical `<code>--<chainId>` shape. Zcash also has two fundamentally
different data domains: transparent activity can be indexed by the backend,
but shielded activity can only be discovered with the account's viewing key.

## Decision

The mainnet identity is fixed as:

| Field | Value |
| --- | --- |
| OneKey network ID | `zec--0` |
| implementation | `zec` |
| code / shortcode | `zec` |
| chain ID | `0` |
| backend chain key | `ZEC0` |

The preset remains disabled by default until transaction acceptance is signed
off. It is mainnet (`isTestnet: false`); real TAZ testnet remains a runtime and
App-harness concern rather than a second visible preset.

The implementation identifier matches the `zec--0` prefix because OneKey
derives the implementation from the network ID before loading Vault settings.

Data ownership is split as follows:

- OneKey backend `ZEC0` owns transparent balance, Token metadata/pricing, and
  transparent History.
- The local runtime owns Sapling, Orchard, and Ironwood balance/history, local
  spendability, and every transaction created locally.
- Token balance is composed from the backend transparent value plus the local
  private value. Spendability always comes from the runtime.
- History is merged by txid. A local row wins collisions because it can contain
  private pool metadata and the locally-observed transaction lifecycle.
- Backend failure falls back to the runtime's local transparent view. An
  incomplete backend page sequence must not delete cached transparent rows.
- Generic SimpleDB history may retain only the exact transparent projection
  (`privacyChainHistorySide: public`, pool IDs exactly `[0]`). Private and mixed
  rows are runtime-only. A one-time boundary migration also removes those rows
  from old `zcash--0` and current `zec--0` cache keys.

The runtime uses one rebuildable SQLite database per Zcash network. Every
registered account, including accounts derived from different seeds, shares
that scan domain. UFVK and birthday in App account metadata remain the recovery
source of truth.

## Consequences

- `zcash--0` and `ZEC--0` are invalid aliases and must not be introduced.
- Backend index data must never replace private history or decide whether an
  amount is spendable.
- Account deletion removes that account from the shared database; the database
  file is deleted only after its last account is removed.
- Desktop/web are single-JS-runtime targets. iOS, Android, and extension have
  separate `main` and `bg` JS heaps that initialize independently; the Zcash
  carrier owns the network database and callers must not assume cross-heap
  readiness or shared JS objects.

## Alternatives rejected

- A second visible testnet preset: it would add product identity and backend
  requirements merely to exercise a runtime test harness.
- Backend-only balance/history: it cannot see shielded pools.
- Runtime-only transparent data: it discards the indexed ZEC0 integration and
  backend pricing.
- One database per seed: it duplicates network download and scanning work and
  conflicts with the carrier's actual network-scoped database key.
