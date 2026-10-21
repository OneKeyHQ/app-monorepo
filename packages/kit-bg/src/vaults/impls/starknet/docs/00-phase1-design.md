# Starknet Phase 1 (transparent accounts) — design record

Date: 2026-09-17. Branch `feat-support-starknet`, based on `x` @ d0fd2046e3.
Template chain: Stellar (commit 9394146588).

## Scope

In: HD / imported / watching accounts, STRK + ERC-20 balances, ERC-20 transfer,
fee estimation, broadcast, pending-tx resolution, mainnet + Sepolia.
Out (deliberately): OneKey hardware (hd-core has no Starknet), dApp provider
(`IInjectedProviderNames` lives in cross-inpage-provider-types), on-chain
history list, fiat prices, fee editor, privacy pool (Phase 2, see `01-*.md`).

## Keys and addresses

- Three derive types share the template `m/44'/9004'/0'/0/{index}` (curve
  `secp256k1`, Argent X `derivationPaths.ts`); the OpenZeppelin and OKX ones
  carry the id suffix / address encoding `StarknetOZ` / `StarknetOKX`. The child key is ground with
  `ec.starkCurve.grindKey` into the Stark key in both.
- Default = Argent (decided 2026-10-20: about 62% of active mainnet accounts
  sampled that day were Argent, 21% OpenZeppelin spread over 9 versions, 10% Braavos).
  HD keys follow Argent X exactly: Ethereum key at `m/44'/60'/0'/0/0`, used as
  the BIP32 seed with leading zero bytes dropped (Argent passes it through
  `num.toHex`), then the template path. Account contract v0.4.0, class hash
  `0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f`,
  constructor `[0, publicKey, 1]` (Signer::Starknet owner, no guardian), salt =
  publicKey, deployer 0. Verified against Argent X's own derivation vectors and
  live mainnet accounts; a v0.4.0 account first created under an older Argent
  class keeps that older address and is not found.
- `StarknetOZ` = OpenZeppelin account v1.0.0, class hash
  `0x05b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564`, the OZ
  class OneKey firmware signs for (2026-10-21; v0.17.0 before, same constructor);
  HD key derives straight from the wallet seed. Constructor `[publicKey]`,
  salt = publicKey, deployer 0.
- `StarknetOKX` = OKX Wallet Cairo 1 account, class hash
  `0x01c0bb51e2ce73dc007601a1e7725453627254016c28f118251a71bbb0507fcb`, the
  class OKX deploys for new accounts and firmware signs for. HD key as Argent X
  but the Ethereum key seeds BIP32 as all 32 bytes, leading zeros kept
  (okx/js-wallet-sdk coin-starknet `getDerivedPrivateKey`). Constructor
  `[publicKey, 0]` (owner, no guardian), salt = publicKey, deployer 0, matched
  against live OKX accounts. OKX's older Cairo 0 proxy accounts
  (`0x3530cc…`, which that SDK still computes) are not found.
- Supported set decided 2026-10-21 from a two-week census of wallets moving
  large STRK/ETH/USDC/USDT: one version each of Argent, OKX and OpenZeppelin.
- Imported accounts take a raw Stark private key; the derive type picks the
  contract. Exported key is `0x` + 64 hex.
- Every private-key surface (`getPrivateKeys`, `getExportedSecretKey`, signing,
  STRK20 viewing key and proof invocation) means the Stark key and needs the
  account's address encoding; the Starknet keyrings pass it on every call.
  Grinding happens in core only.
- App stores addresses zero-padded 64-hex lowercase. RPC felts forbid leading
  zeros; core emits spec-valid felts in `IStarknetRawTx`, kit-bg routes its own
  outbound felts through core's `toFelt`.

## Transactions

- v3 only, STRK fees. `IEncodedTxStarknet` carries the invoke plus an optional
  counterfactual `deployAccount`; all numerics are hex strings (bg/main boundary).
- Deploy detection happens on every `buildEncodedTx` via `starknet_getClassHashAt`
  at `pre_confirmed`; only RPC error 20 means undeployed. Never cached.
- Undeployed sender: DEPLOY_ACCOUNT (nonce 0) then INVOKE (nonce 1), estimated as
  one two-element `starknet_estimateFee` call with `SKIP_VALIDATE`, broadcast
  sequentially. If deploy lands and invoke fails, the error says so; the next
  attempt re-detects and uses the RPC nonce.
- Resource bounds: node estimate × 1.5 on amount and price (matches starknet.js
  `resourceBoundsOverhead`). Displayed range: min = node `overall_fee`,
  max = signed bound. Deploy fee shown as "Account activation (one-time)" via
  `decodedTx.extraInfo.deployAccountFee`; the deploy txid is recomputed from the
  encodedTx, never stored on the vault instance.
- Tx status: Success only when `finality_status` ∈ {ACCEPTED_ON_L2, ACCEPTED_ON_L1};
  REJECTED → Failed; everything else Pending.

## Backend-less operation

`VaultBase`'s `*ByRpc` bypasses only fire for custom networks, so the Starknet
vault overrides the top-level `fetchAccountDetails`, `fetchTokenList`,
`fetchTokenDetails`, `estimateFee`, `fetchAccountHistoryDetail` and
`broadcastTransaction`. History list is disabled through the new
`IVaultSettings.serverHistoryUnsupported` (only Starknet sets it; the dead
`onChainHistoryDisabled` flag was left untouched).

Transport mirrors Stellar: `OneKeyTransport` (backend proxy, `rpc` route) and
`JsonRpcTransport` (direct). Custom RPC wins; otherwise
`STARKNET_BACKEND_PROXY_ENABLED` in `sdkStarknet/consts.ts` chooses. It is
`false` until the backend proxies Starknet; default URLs are Cartridge
`/rpc/v0_9` on both networks (Blast public endpoints are shut down). No runtime
fallback between proxy and public RPC.

Backend work needed for parity: proxy route for `starknet--mainnet` /
`starknet--sepolia`, then history list, token list/search, account, estimate-fee
and send-transaction endpoints.

## Open items at handover

- Real Sepolia DEPLOY_ACCOUNT + INVOKE broadcast: harness in
  `liveRpc.probe.test.ts`, needs a funded key (`STARKNET_SEPOLIA_PRIVATE_KEY`).
- Two strings need Lokalise keys: confirm-screen label
  "Account activation (one-time)" and the deploy-then-invoke failure message.
- `networkDetectUtils` now suggests Starknet for 0x + 41..64 hex inputs.
