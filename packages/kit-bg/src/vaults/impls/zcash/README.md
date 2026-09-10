# Zcash integration

Status: **transparent + shielded (Sapling/Orchard/Ironwood) receive & balance
working end-to-end; send via PCZT implemented; hardware deferred.** Dev-only
(`SUPPORTED_IMPLS`, not `PRODUCTION_IMPLS`).

For the deep-dive material this file used to carry inline, see `docs/`:

- [`docs/01-protocol-and-pools.md`](./docs/01-protocol-and-pools.md) — what
  Sapling/Orchard/Ironwood actually are, how a tx is built per pool, how
  balance and history are computed, addresses, fees.
- [`docs/02-business-flow.md`](./docs/02-business-flow.md) — account
  creation & birthday, the sync/scan lifecycle, how balance/history/send are
  served to the rest of the app.
- [`docs/03-sdk-integration.md`](./docs/03-sdk-integration.md) — the WebZjs
  wasm SDK surface, the three-carrier platform pattern, our `Vault`/`KeyringHd`
  seams, and the hardware (PCZT) signing boundary.
- [`docs/04-pitfalls.md`](./docs/04-pitfalls.md) — debugging playbook: every
  non-obvious bug this integration has hit, symptom → root cause → fix.
- [`docs/05-decisions-and-open-questions.md`](./docs/05-decisions-and-open-questions.md)
  — why we chose what we chose, and what's still undecided.

## What ships today

- **Core chain** `packages/core/src/chains/zcash/` — `extends CoreChainSoftwareBtc`.
  Transparent address derivation reuses the BTC pipeline; only address
  encoding and the transaction-signing seam are Zcash-specific.
- **Vault** `packages/kit-bg/src/vaults/impls/zcash/` — `extends VaultBtc`
  (`getBlockbookCoinName() === 'Zcash'`) for the transparent/account backbone,
  with `fetchAccountDetails`, `fetchTokenList`, and
  `fetchAccountHistoryFromLocal` all overridden to serve shielded-aware state
  computed client-side (see `docs/02`). Software keyrings only: `hd`,
  `imported`, `watching`.
- **Shielded engine**: our WebZjs fork (`ByteZhang1024/WebZjs`, local clone at
  `../WebZjs`), vendoring a hand-ported `zcash_client_memory` (IndexedDB-shaped
  in-memory wallet backend — see `docs/01` and `docs/05` for why). Published
  as `@bytezhang/webzjs-{wallet,keys}` on npm (self-published; upstream
  ChainSafe has no release). Keys (derive/sign) and wallet (sync/balance/PCZT)
  are separate wasm modules — see `docs/03`.
- Registered dev-only: in `SUPPORTED_IMPLS` but **not** `PRODUCTION_IMPLS`;
  preset network has `defaultEnabled:false`, `backendIndex:false`.

## Two Zcash-specific pieces in the transparent/BTC layer

1. **2-byte address prefix** (`sdkZcash/index.ts`). Zcash t-addresses use a
   2-byte version (t1 = `0x1cb8` P2PKH, t3 = `0x1cbd` P2SH); bitcoinjs only
   supports a single byte. Like BCH's legacy↔cashaddr override, we bridge at
   the `encodeAddress`/`decodeAddress` boundary between the BTC-legacy
   intermediate (`1…`/`3…`, driven by `networks.ts` `zcash.pubKeyHash=0x00`/
   `scriptHash=0x05`) and the real t-address. `validateZcashAddress` decodes
   first, then reuses the BTC validator, and rejects shielded (`zs`/`u1`/`zc`)
   input.

2. **Signing is intentionally NOT the BTC path.** `KeyringHd.signTransaction`
   never touches bitcoinjs PSBT — Zcash uses v4/v5 serialization with
   ZIP-243/244 sighashes, produced by the PCZT signer inside the keys wasm.
   See `docs/02` for the full create → prove → sign → broadcast flow.

Hardware (`hw`) and QR are deferred: the hardware SDK's `INetwork` union has no
`zec`, so those keyrings are `undefined` until an SDK bump + firmware land
(see `docs/03` for the PCZT seam that will carry this).

## ⚠️ Pool target: Ironwood (NU6.3), not Orchard

As of 2026-07-28 (NU6.3 "Ironwood", activated after an Orchard circuit
soundness disclosure), the **Orchard pool is withdrawal-only** — an
Orchard-only wallet can no longer receive shielded funds. The shielded target
for this integration is therefore **Ironwood**. Full protocol detail in
`docs/01`; the Orchard→Ironwood migration story and pool-evolution rules in
`docs/05`.

## Open items

See `docs/05-decisions-and-open-questions.md` for the live list. Highlights:
native mobile sync module (Kotlin/Swift bridge) not yet built; a Zcash
Blockbook + lightwalletd proxy are server-side prerequisites we don't own;
the TokenDetails pool-breakdown UI (balance breakdown, shield button, sync
progress, birthday edit — `docs/02`) is written and typechecked but not yet
live-verified in a browser.
