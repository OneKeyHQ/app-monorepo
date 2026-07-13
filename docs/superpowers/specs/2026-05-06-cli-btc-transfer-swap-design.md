# CLI BTC/TBTC Transfer And Swap Design

## Goal

Extend `apps/cli` from BTC/TBTC read-only support to full BTC-family wallet operations:

- Derive BTC/TBTC wallet addresses from the current CLI auth session.
- Show BTC/TBTC balances and history from the logged-in wallet, with aggregate and per-address-type views.
- Send BTC/TBTC native transfers.
- Quote, build, execute, and track BTC/TBTC swap or bridge routes when the swap backend reports the network as supported.

Completion requires both the `app-monorepo` implementation tests and the cross-repo `onekey-tools` `cli-e2e` coverage to pass against the local CLI.

## Non-Goals

- No independent BTC message-signing command.
- No external PSBT signing command.
- No Ledger support in the CLI first version.
- No imported private-key, watching, QR, or external wallet support.
- No batch BTC transfer, coin control, send-max, custom fee rate, or fee preset flags.
- No direct reuse of the App `kit-bg` Vault runtime inside the CLI.
- No hardcoded BTC mainnet versus testnet swap allowlist in the CLI.

## Existing CLI Baseline

The design follows the current EVM CLI implementation:

- `apps/cli/src/signer/registry.ts` maps chain `impl` to wallet-kind builders.
- `getSignerByImpl(impl)` resolves the active auth session and dispatches to HD or hardware signers.
- EVM HD signing is a thin wrapper over `@onekeyhq/core/src/chains/evm`.
- EVM hardware signing is a thin wrapper over hardware SDK calls, while `SignerHardwareBase` owns unlock, passphrase, and session-cache plumbing.
- `transfer` builds the transaction in the command layer, estimates fees through wallet API, signs, then broadcasts.
- `swap build/execute` performs quote, build-tx, pending-order persistence, allowance, fee, nonce, sign, broadcast, and status orchestration in the CLI command layer.
- There is no user-facing EVM `sign-message` command; message signing is only a signer interface capability.

BTC/TBTC should match that shape: add BTC signer adapters and BTC command-layer transaction orchestration, but do not embed App background services or Vault instances.

## Chain Capabilities

Extend CLI capabilities beyond the current BTC read-only set:

- `accountRead`: BTC and TBTC.
- `historyRead`: BTC and TBTC.
- `btcTransfer`: BTC and TBTC.
- `swap`: BTC and TBTC only when `/swap/v1/networks` includes the concrete `networkId`.

Do not make BTC pass through EVM-specific capabilities such as `evmTransfer`, `evmTokenMarket`, or `evmSecurity`.

`swap networks` must stop filtering by `networkId.startsWith('evm--')`. It should return every backend-supported network that also exists in `presetNetworks`, including `btc--0` and `tbtc--0` when present.

## Address-Type Model

The CLI uses user-facing address-type names and maps them to the same BTC derivation concepts used by the App:

| CLI `address-type` | deriveType | addressEncoding | Template |
| --- | --- | --- | --- |
| `taproot` | `BIP86` | `P2TR` | `m/86'/coinType'/0'/0/0` |
| `native-segwit` | `BIP84` | `P2WPKH` | `m/84'/coinType'/0'/0/0` |
| `nested-segwit` | `default` | `P2SH_P2WPKH` | `m/49'/coinType'/0'/0/0` |
| `legacy` | `BIP44` | `P2PKH` | `m/44'/coinType'/0'/0/0` |

`coinType` is `0` for BTC and `1` for TBTC.

Spending commands must explicitly receive an address type. The CLI must not silently use a default address type or choose one from balances. This keeps BTC spending deterministic and avoids hidden selection across multiple UTXO accounts.

The first version always uses account index `0` and the first receive address, `m/.../0/0`. Change also returns to the selected address type's first receive address. The first version does not use change path `m/.../1/0`.

## Command Surface

### Wallet Address Commands

Add wallet-scoped BTC address introspection commands. Do not add a top-level `btc` command namespace.

```bash
onekey wallet address-types --chain btc
onekey wallet address --chain btc --address-type taproot
onekey wallet address --chain tbtc --address-type native-segwit
```

`wallet address-types` lists the four supported address types with label, deriveType, addressEncoding, and template. `wallet address` derives the logged-in wallet address for one address type.

### Balance And History

Upgrade BTC/TBTC read commands from explicit-address only to logged-in wallet reads:

```bash
onekey balance --chain btc
onekey balance --chain btc --address-type taproot
onekey history --chain btc
onekey history --chain btc --address-type native-segwit
onekey balance --chain btc --address <external-address>
onekey history --chain btc --address <external-address>
```

Behavior:

- Without `--address` and without `--address-type`, derive all four address types and return an aggregate total plus per-address-type items.
- With `--address-type`, derive and query only that address type.
- With `--address`, keep the current external-address read-only behavior. `--address` must not combine with `--address-type`.

### Transfer

Add a BTC/TBTC branch to the existing `transfer` command:

```bash
onekey transfer --chain btc --address-type taproot --to <btc-address> --amount 0.001
onekey transfer --chain tbtc --address-type native-segwit --to <tbtc-address> --amount 0.001 --dry-run
```

BTC/TBTC transfer behavior:

- `--address-type` is required.
- Only native BTC/TBTC transfer is supported.
- The recipient must be valid for the selected network.
- The sender and change address are the logged-in wallet's first receive address for the selected address type.
- UTXOs are collected only for the selected address type.
- Coin selection should align with `packages/kit-bg/src/vaults/impls/btc/Vault.ts` semantics, especially the `coinSelectWithWitness` inputs, outputs, fee rate, and tx type model.
- The CLI first version uses the default recommended fee rate. It exposes no fee-rate or fee-preset option.
- `--dry-run` builds and displays the transaction plan, fee, tx size, inputs, and outputs. It must not sign or broadcast.
- Non-dry-run follows the existing confirmation model: human/TTY prompts unless `--yes`; JSON/agent execution remains structured.
- Broadcast result uses BTC txid validation: 64 hex characters, no required `0x` prefix.

### Swap And Bridge

BTC/TBTC swap support follows backend-reported capabilities from `/swap/v1/networks`.

Address-type flags are directional to avoid ambiguity:

```bash
onekey swap quote --chain btc --from-address-type taproot --to-chain eth ...
onekey swap quote --chain eth --to-chain btc --to-address-type native-segwit ...
onekey swap build --chain btc --from-address-type taproot --to-chain eth ...
onekey swap execute --chain btc --from-address-type taproot --order <orderId>
```

Rules:

- If BTC/TBTC is the source side, `--from-address-type` is required.
- If BTC/TBTC is the destination side, `--to-address-type` is required.
- If both sides are BTC-family networks, both flags are required.
- BTC/TBTC destination addresses are derived from the current logged-in wallet. The first version does not support an external BTC receiving address.
- `quote`, `build`, and `execute` all enforce the relevant BTC address type so the saved order is deterministic.
- `build` persists BTC address metadata into the pending order: source address type, source address encoding, source address, destination address type when present, destination address encoding, and receiving address.
- `execute` re-derives the relevant address and rejects the order if the current wallet no longer matches the build-time address.
- BTC-source `execute` does not run EVM allowance, nonce, gas, `tx.to`, or calldata validation.
- BTC-source `execute` handles `build-tx` `btcData.hexStr` as PSBT input and checks `btcData.addressType` against the selected address encoding before signing.
- If `btcData.addressType` does not include the selected encoding, the CLI returns a derivation-path restriction error and suggests a matching `--from-address-type`.

`swap status` remains order-based and chain-agnostic unless a specific backend response shape requires additional BTC metadata.

## Signer Design

Add `apps/cli/src/signer/impls/btc` with the same shape as `impls/evm`:

- `index.ts`: exports `btcSignerBuilders` and `tbtcSignerBuilders`.
- `btc-path.ts`: maps network impl and address type to template, deriveType, addressEncoding, coinType, and full path.
- `SignerHd.ts`: derives addresses and signs BTC transactions through `@onekeyhq/core/src/chains/btc`.
- `SignerHardware.ts`: derives addresses and signs BTC transactions/PSBTs through OneKey hardware SDK BTC methods.

The shared `ISigner` contract needs BTC-specific signing input. Extend `ISignTransactionPayload` narrowly instead of creating command-specific signer APIs:

- `networkId`
- `account`
- `unsignedTx`
- optional `relPaths`
- optional `btcExtraInfo`
- optional `addressType` metadata for validation/logging
- optional `signOnly` if the core BTC path requires it for PSBT flows

EVM callers continue to work with the existing minimal payload.

## BTC Transaction Builder

Add BTC transaction-building helpers under `apps/cli/src/commands/transfer` support modules or `apps/cli/src/core/btc`. Keep the code independent from `kit-bg`.

Responsibilities:

- Fetch account details and UTXOs for one derived BTC/TBTC address.
- Convert CLI amount into satoshis.
- Build `IEncodedTxBtc` with one payment output and change back to the selected receive address.
- Prepare `btcExtraInfo` needed by `CoreChainSoftware.signTransaction`, including path-to-address and address-to-path mappings, input address encodings, and non-witness previous txs when required.
- Keep the data shape close to `Vault.prepareBtcSignExtraInfo` so behavior does not drift from App signing.

If Vault code contains pure logic that can be reused without `backgroundApi`, extract it to an import-safe layer that respects the monorepo hierarchy. Do not import `kit` or `kit-bg` from `apps/cli` for transaction construction.

## Auth Session Impact

Current auth session metadata stores one EVM display address. That should remain compatible. BTC commands derive their required address at runtime from the active HD or hardware session.

Do not require re-login only to add BTC support unless the existing hardware session lacks device/passphrase metadata. Hardware login can still display the EVM address because the session identity is wallet-level, not chain-level.

`auth status` may optionally include future chain-derived addresses, but that is not required for this feature.

## Error Handling

Required structured errors:

- Missing `--address-type` for BTC/TBTC spend commands.
- Invalid address type.
- `--address` combined with `--address-type` on read-only external-address queries.
- BTC/TBTC swap network absent from `/swap/v1/networks`.
- BTC/TBTC swap route does not support the selected address encoding.
- Insufficient UTXO balance.
- No usable UTXOs.
- Hardware BTC method unsupported by the connected OneKey device.
- Broadcast returns an invalid BTC txid.
- Pending order wallet/address mismatch at execute time.

## `onekey-tools` `cli-e2e` Requirements

The implementation is not complete until `/Users/leon/Documents/onekey/onekey-tools/packages/cli-e2e` is updated and passing against the local CLI.

Current baseline:

- Root script `cli-e2e:cli-integration:local-cli` points `ONEKEY_BIN` at `../app-monorepo/apps/cli/bin/onekey`.
- Profiles are `safe`, `read-only`, `testnet-spend`, and `mainnet-spend`.
- `safe` currently runs read-only checks plus Sepolia testnet spend.
- BTC/TBTC read-only checks exist in the read-only section.
- Current read-only BTC negative check expects `tbtc transfer` to be unsupported; this must be replaced after BTC transfer lands.

Required e2e updates:

- Read-only profile:
  - Keep external-address TBTC checks.
  - Add logged-in wallet BTC/TBTC aggregate balance checks when an auth session exists.
  - Add per-address-type balance/history checks for at least `taproot` and `native-segwit`, with schema coverage for all four address types.
  - Replace the old `tbtc-transfer-unsupported` negative case with missing `--address-type` and invalid address-type negatives.
  - Add `wallet address-types --chain btc` and `wallet address --chain tbtc --address-type ...` checks.
- Testnet-spend profile:
  - Add TBTC dry-run transfer for one configured address type.
  - Add optional TBTC broadcast transfer only when the operator explicitly configures a funded TBTC fixture and enables a spend guard.
  - Keep Sepolia transfer coverage.
- Mainnet-spend profile:
  - Add BTC swap/bridge coverage only behind the existing mainnet spend guard.
  - Use tiny amounts and backend-supported routes discovered at runtime.
  - If BTC is not returned by `/swap/v1/networks`, mark the BTC swap section skipped or benign, not failed.
- Schemas:
  - Extend balance/history schemas for aggregate BTC address-type items.
  - Extend transfer schema to accept BTC txids.
  - Extend swap build/execute schemas with BTC address metadata and PSBT-driven result fields.
- Runbook:
  - Document BTC/TBTC address-type flags, TBTC funding requirements, and mainnet BTC swap guard.

Required verification commands:

```bash
# app-monorepo
yarn jest --config apps/cli/jest.config.js --runInBand <btc-related-tests>

# onekey-tools
ONEKEY_APP_MONOREPO_DIR=/Users/leon/Documents/onekey/app-monorepo \
  yarn cli-e2e:cli-integration:local-cli
```

If a broadcast e2e case requires funds, the suite must fail preflight with clear fixture guidance rather than partially executing.

## Success Criteria

- BTC/TBTC read-only commands work for both external addresses and logged-in wallet-derived addresses.
- BTC/TBTC transfer dry-run works for all four address types.
- TBTC transfer signing and broadcast work for at least one configured funded testnet address type.
- BTC/TBTC swap quote/build/execute use backend dynamic network support and reject unsupported networks cleanly.
- BTC-source swap execute signs PSBT data only when `btcData.addressType` matches the selected address type.
- Software HD/app-transfer and OneKey hardware signing both have unit coverage.
- `app-monorepo` CLI Jest tests pass.
- `onekey-tools` `cli-e2e:cli-integration:local-cli` passes in the safe profile.
- Mainnet BTC swap/bridge e2e coverage remains opt-in behind the existing mainnet spend guard.

## Open Implementation Notes

- Confirm the exact wallet API response shape for BTC UTXO list and previous transaction data before implementing the BTC transaction builder.
- Confirm the exact OneKey hardware SDK BTC method payloads available in the installed SDK version before coding `SignerHardware`.
- Confirm whether backend exposes `tbtc--0` in `/swap/v1/networks` in the target environment; the CLI must remain dynamic either way.
