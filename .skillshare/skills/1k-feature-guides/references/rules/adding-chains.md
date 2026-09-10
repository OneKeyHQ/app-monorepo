# Adding New Chains to OneKey

## Overview

OneKey supports 40+ blockchains with pluggable chain implementations. This guide covers the process of adding new chain support.

## Steps to Add a New Chain

### 1. Implement Chain Core Logic
Location: `packages/core/src/chains/`

Create a new directory for the chain (tests are co-located with sources —
every existing chain follows this; `packages/core/src/@tests/` is reserved for
SHARED test utilities/fixtures, never per-chain tests):
```
packages/core/src/chains/mychain/
├── index.ts                   # CoreChainScope (hd/imported api proxies)
├── types.ts                   # Chain-specific types
├── CoreChainSoftware.ts       # Software wallet implementation
├── CoreChainSoftware.test.ts  # Tests co-located next to sources
└── sdkMychain/                # SDK wrapper if needed
    ├── index.ts
    └── index.test.ts
```

### 2. Add Chain Configuration

Two registration points (there is no `config/chains/` directory):

- `packages/shared/src/engine/engineConsts.ts` — `IMPL_MYCHAIN`,
  `COINTYPE_MYCHAIN`, `COINNAME_MYCHAIN`; add the impl to `SUPPORTED_IMPLS`
  (and to `PRODUCTION_IMPLS` only when release-ready).
- `packages/shared/src/config/presetNetworks.ts` — add the `IServerNetwork`
  object and register it in both export collections in the same file.

### 3. Update UI Components for Chain-Specific Features
Location: `packages/kit/src/`

Add any chain-specific UI components or modifications needed for:
- Transaction building
- Address display
- Token management
- Network selection

### 4. Add Tests for Chain Functionality
Location: co-located with sources (`CoreChainSoftware.test.ts`,
`sdkMychain/index.test.ts`)

Write comprehensive tests:
```typescript
describe('MyChain', () => {
  it('should generate valid addresses', () => {
    // test address generation
  });

  it('should sign transactions correctly', () => {
    // test transaction signing
  });

  it('should validate addresses', () => {
    // test address validation
  });
});
```

## Chain Implementation Checklist

- [ ] Core chain logic in `packages/core/src/chains/`
- [ ] Chain configuration in `packages/shared/`
- [ ] Address generation and validation
- [ ] Transaction building and signing
- [ ] Balance fetching
- [ ] Token support (if applicable)
- [ ] Hardware wallet support (if applicable)
- [ ] UI components updated
- [ ] Tests written and passing
- [ ] Documentation added

## Reference Existing Implementations

Look at existing chain implementations for guidance:
- EVM chains: `packages/core/src/chains/evm/`
- Bitcoin: `packages/core/src/chains/btc/`
- Solana: `packages/core/src/chains/sol/`

## Common Patterns

### Chain Registry Pattern
```typescript
// packages/core/src/chains/index.ts
export const chainRegistry = {
  evm: () => import('./evm'),
  btc: () => import('./btc'),
  sol: () => import('./sol'),
  mychain: () => import('./mychain'),
};
```

### Address Validation
```typescript
export function validateAddress(address: string): boolean {
  // Implement chain-specific validation
  return isValidAddress(address);
}
```

### Transaction Building
```typescript
export async function buildTransaction(params: TxParams): Promise<UnsignedTx> {
  // Build unsigned transaction
  return {
    // transaction data
  };
}
```

## Privacy Chains (Zcash / Monero-family / privacy pools)

Privacy chains break the "backend serves account data" assumption: shielded
balances are cryptographically invisible to any server (viewing keys required),
so balance/history/state must be computed client-side. Reference
implementation: `packages/kit-bg/src/vaults/impls/zcash/` (+ its README).

### Where the standard flows break, and the established seams

| Broken assumption | Seam to use |
|---|---|
| Balance/token list come from backend | override `vault.fetchAccountDetails` + `vault.fetchTokenList` (serve locally) |
| History comes from backend | override `vault.fetchAccountHistoryFromLocal` (VaultBase hook; a defined result replaces the server query in ServiceHistory) |
| Fee comes from backend | override `vault.estimateFee` |
| Broadcast returns a txid | set `withoutBroadcastTxId: true` if the protocol yields none pre-broadcast |
| BTC-style precheck (blockbook UTXO list) | override `precheckUnsignedTx` when inheriting a UTXO vault |
| UI needs chain-specific data (viewing addresses, sync state) | a per-chain Service (`ServiceLightning`/`ServiceNostr`/`ServiceZcash` precedent) + a per-chain SimpleDb entity for viewing-level meta |
| Heavy crypto (wasm/proving) | platform carrier pattern: `sdkXxx/sdk/index.{web,ext-bg-v3,native}.ts` + offscreen/webembed delegates (kaspa/zcash precedent) |

### Settings inheritance is a trap

When spreading another chain's settings (`{...settingsBtc}`), audit EVERY
inherited `true` flag: each one is a UI entry point promising a code path you
may not have implemented (bulk send, coin control, custom RPC, hardware,
imported/watching accounts...). Rule: an account type or feature ships enabled
only when its full flow works — "用不了就不搞".

### Address scheme versioning (wallet-owned)

Privacy-chain address FORMS evolve while the keys stay the same (new receiver
types, receiver-composition policy). Persist addresses only as a CACHE stamped
with a wallet-owned `addressSchemeVersion` (our compatibility ledger — NOT the
SDK's or the protocol's version). Bump it ONLY when WE change what a given key
derives to; on version mismatch, lazily re-derive from the stored viewing key
(no password needed) and overwrite. When bumping the wasm SDK, run the chain's
golden-address check (fixed test mnemonic vs committed expected addresses) —
if outputs changed, the same diff must bump the scheme version and update the
golden values.

### Structurally impossible (set product expectations, not bugs)

Backend push notifications for shielded receipts, server-side address book
validation of shielded addresses, swap/fiat integrations that assume indexed
balances, cloud sync of local chain state.
