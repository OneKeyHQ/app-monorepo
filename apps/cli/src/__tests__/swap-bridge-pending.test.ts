// apps/cli/src/__tests__/swap-bridge-pending.test.ts
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  _resetPendingDir,
  _setPendingDirForTest,
  loadPending,
  savePending,
} from '../core/pending-storage';

import type { IPendingOrder } from '../core/pending-storage';

function makeBridgeOrder(overrides?: Partial<IPendingOrder>): IPendingOrder {
  return {
    orderId: 'test-bridge-001',
    status: 'pending',
    chain: 'eth',
    networkId: 'evm--1',
    toNetworkId: 'evm--42161',
    protocolType: 'Bridge',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fromToken: {
      contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      decimals: 6,
    },
    toToken: {
      contractAddress: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
      symbol: 'USDC',
      decimals: 6,
    },
    amount: '100',
    txData: { tx: { to: '0x1234567890abcdef1234567890abcdef12345678' } },
    ...overrides,
  };
}

describe('pending-storage bridge extensions', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'pending-bridge-'));
    _setPendingDirForTest(tempDir);
  });

  afterEach(() => {
    _resetPendingDir();
  });

  it('saves and loads a bridge order with toNetworkId and protocolType', () => {
    const order = makeBridgeOrder();
    savePending(order.orderId, order);
    const loaded = loadPending(order.orderId);
    expect(loaded.toNetworkId).toBe('evm--42161');
    expect(loaded.protocolType).toBe('Bridge');
  });

  it('loads a legacy order without toNetworkId/protocolType (backward compat)', () => {
    const legacyData = {
      orderId: 'legacy-001',
      status: 'pending',
      chain: 'eth',
      networkId: 'evm--1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fromToken: { contractAddress: '0xA0b8', symbol: 'USDC', decimals: 6 },
      toToken: { contractAddress: '0xFF97', symbol: 'USDT', decimals: 6 },
      amount: '50',
      txData: { tx: {} },
    };
    writeFileSync(
      join(tempDir, 'legacy-001.json'),
      JSON.stringify(legacyData, null, 2),
    );
    const loaded = loadPending('legacy-001');
    expect(loaded.orderId).toBe('legacy-001');
    expect(loaded.toNetworkId).toBeUndefined();
    expect(loaded.protocolType).toBeUndefined();
  });

  it('respects custom expiryMs when provided', () => {
    const order = makeBridgeOrder({
      createdAt: Date.now() - 10 * 60_000, // 10 minutes ago
    });
    savePending(order.orderId, order);

    // Default 5min expiry: should throw
    expect(() => loadPending(order.orderId)).toThrow(/expired/);

    // 30min expiry: should not throw
    const loaded = loadPending(order.orderId, { expiryMs: 30 * 60_000 });
    expect(loaded.orderId).toBe(order.orderId);
  });
});
