/**
 * Smoke tests for cross-chain bridge CLI commands.
 *
 * Tests parameter parsing, protocol switching, and error handling
 * without hitting real APIs (uses mocked infra).
 *
 * Run: npx jest swap-bridge-smoke --no-cache --no-coverage
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { extractJson } from './test-helpers';

const BIN = resolve(__dirname, '../../bin/onekey');

function runSafe(...args: string[]): string {
  try {
    return execFileSync(BIN, args, {
      encoding: 'utf-8',
      timeout: 15_000,
    }).trim();
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string };
    return (e.stdout ?? e.stderr ?? '').toString().trim();
  }
}

describe('--to-chain parameter parsing', () => {
  it('swap quote --help includes --to-chain option', () => {
    const output = runSafe('swap', 'quote', '--help');
    expect(output).toContain('--to-chain');
    expect(output).toContain('Destination chain');
  });

  it('swap build --help includes --to-chain option', () => {
    const output = runSafe('swap', 'build', '--help');
    expect(output).toContain('--to-chain');
  });

  it('swap status --help includes --watch option', () => {
    const output = runSafe('swap', 'status', '--help');
    expect(output).toContain('--watch');
  });

  it('swap status --help includes --protocol option', () => {
    const output = runSafe('swap', 'status', '--help');
    expect(output).toContain('--protocol');
  });

  it('swap networks --help includes --bridge option', () => {
    const output = runSafe('swap', 'networks', '--help');
    expect(output).toContain('--bridge');
  });
});

describe('cross-chain validation errors', () => {
  it('rejects --to-chain with invalid chain name', () => {
    const output = runSafe(
      '--json',
      '--env',
      'test',
      'swap',
      'quote',
      '--chain',
      'eth',
      '--to-chain',
      'nonexistent_chain_xyz',
      '--from',
      'USDC',
      '--to',
      'USDC',
      '--amount',
      '10',
    );
    const parsed = JSON.parse(extractJson(output));
    expect(parsed.status).toBe('error');
    expect(parsed.error).toHaveProperty('code');
  });
});

describe('protocol config integration', () => {
  it('getProtocolConfig is importable and functional', () => {
    // This test verifies the module can be loaded at runtime
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const { getProtocolConfig, SWAP_CONFIG, BRIDGE_CONFIG } =
      require('../commands/swap/swap-protocol-config') as {
        getProtocolConfig: (from: string, to: string) => unknown;
        SWAP_CONFIG: { protocol: string };
        BRIDGE_CONFIG: { protocol: string };
      };

    expect(getProtocolConfig('evm--1', 'evm--1')).toBe(SWAP_CONFIG);
    expect(getProtocolConfig('evm--1', 'evm--42161')).toBe(BRIDGE_CONFIG);
    expect(BRIDGE_CONFIG.protocol).toBe('Bridge');
    expect(SWAP_CONFIG.protocol).toBe('Swap');
  });
});

describe('pending storage bridge fields', () => {
  it('IPendingOrder accepts bridge fields', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const {
      savePending,
      loadPending,
      _setPendingDirForTest,
      _resetPendingDir,
    } = require('../core/pending-storage') as {
      savePending: (id: string, data: unknown) => void;
      loadPending: (
        id: string,
        opts?: { expiryMs: number },
      ) => Record<string, unknown>;
      _setPendingDirForTest: (dir: string) => void;
      _resetPendingDir: () => void;
    };
    const nodeFs = require('node:fs') as typeof import('node:fs');
    const nodeOs = require('node:os') as typeof import('node:os');
    const nodePath = require('node:path') as typeof import('node:path');

    const tempDir = nodeFs.mkdtempSync(
      nodePath.join(nodeOs.tmpdir(), 'bridge-smoke-'),
    );
    _setPendingDirForTest(tempDir);

    try {
      const order = {
        orderId: 'smoke-bridge-001',
        status: 'pending',
        chain: 'eth',
        networkId: 'evm--1',
        toNetworkId: 'evm--42161',
        protocolType: 'Bridge',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fromToken: { contractAddress: '0xA0b8', symbol: 'USDC', decimals: 6 },
        toToken: { contractAddress: '0xaf88', symbol: 'USDC', decimals: 6 },
        amount: '100',
        txData: { tx: {} },
      };

      savePending(order.orderId, order);
      const loaded = loadPending(order.orderId);
      expect(loaded.toNetworkId).toBe('evm--42161');
      expect(loaded.protocolType).toBe('Bridge');

      // Verify dynamic expiry: 10-min-old order with 30-min expiry should load
      const oldOrder = {
        ...order,
        orderId: 'smoke-bridge-002',
        createdAt: Date.now() - 10 * 60_000,
        updatedAt: Date.now(),
      };
      savePending(oldOrder.orderId, oldOrder);
      expect(() => loadPending(oldOrder.orderId)).toThrow(/expired/);
      const loadedOld = loadPending(oldOrder.orderId, {
        expiryMs: 30 * 60_000,
      });
      expect(loadedOld.orderId).toBe('smoke-bridge-002');
    } finally {
      _resetPendingDir();
    }
  });
});
