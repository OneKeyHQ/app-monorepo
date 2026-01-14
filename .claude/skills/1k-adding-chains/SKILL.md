---
name: 1k-adding-chains
description: Guide for adding new blockchain chains to OneKey. Use when implementing new chain support, adding blockchain protocols, or understanding chain architecture. Triggers on chain, blockchain, protocol, network, coin, token, add chain, new chain.
allowed-tools: Read, Grep, Glob, Write, Edit
---

# Adding New Chains to OneKey

## Overview

OneKey supports 40+ blockchains with pluggable chain implementations. This guide covers the process of adding new chain support.

## Steps to Add a New Chain

### 1. Implement Chain Core Logic
Location: `packages/core/src/chains/`

Create a new directory for the chain:
```
packages/core/src/chains/mychain/
├── index.ts           # Main exports
├── types.ts           # Chain-specific types
├── CoreChainSoftware/ # Software wallet implementation
│   └── index.ts
├── sdkMychain/        # SDK wrapper if needed
│   └── index.ts
└── @tests/            # Chain tests
    └── index.test.ts
```

### 2. Add Chain Configuration
Location: `packages/shared/src/config/chains/`

Add chain constants and configuration:
```typescript
export const CHAIN_MYCHAIN = {
  id: 'mychain',
  name: 'My Chain',
  symbol: 'MYC',
  decimals: 18,
  // ... other chain config
};
```

### 3. Update UI Components for Chain-Specific Features
Location: `packages/kit/src/`

Add any chain-specific UI components or modifications needed for:
- Transaction building
- Address display
- Token management
- Network selection

### 4. Add Tests for Chain Functionality
Location: `packages/core/src/chains/mychain/@tests/`

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
