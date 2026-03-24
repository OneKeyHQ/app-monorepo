import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  _resetPendingDir,
  _setPendingDirForTest,
  listPending,
  loadPending,
  savePending,
  updatePendingStatus,
} from '../core/pending-storage';

import type { IPendingOrder } from '../core/pending-storage';

function makeOrder(overrides?: Partial<IPendingOrder>): IPendingOrder {
  return {
    orderId: 'test-order-1',
    status: 'pending',
    chain: 'eth',
    networkId: 'evm--1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fromToken: { contractAddress: '0xAAA', symbol: 'USDC', decimals: 6 },
    toToken: { contractAddress: '0xBBB', symbol: 'WETH', decimals: 18 },
    amount: '1000000',
    txData: { to: '0xRouter', data: '0x1234' },
    ...overrides,
  };
}

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'pending-test-'));
  _setPendingDirForTest(tempDir);
});

afterEach(() => {
  _resetPendingDir();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('savePending + loadPending', () => {
  it('round-trips order data correctly', () => {
    const order = makeOrder();
    savePending(order.orderId, order);
    const loaded = loadPending(order.orderId);
    expect(loaded).toEqual(order);
  });

  it('creates pending directory if it does not exist', () => {
    const nested = join(tempDir, 'sub', 'dir');
    _setPendingDirForTest(nested);
    const order = makeOrder();
    savePending(order.orderId, order);
    expect(existsSync(nested)).toBe(true);
  });

  it('writes atomically via .tmp + rename', () => {
    const order = makeOrder();
    savePending(order.orderId, order);
    // .tmp file should not remain
    expect(existsSync(join(tempDir, `${order.orderId}.json.tmp`))).toBe(false);
    // .json file should exist
    expect(existsSync(join(tempDir, `${order.orderId}.json`))).toBe(true);
  });
});

describe('loadPending — expiry', () => {
  it('throws BIZ_SWAP_EXPIRED for order older than 5 minutes', () => {
    const order = makeOrder({
      createdAt: Date.now() - 6 * 60 * 1000, // 6 min ago
    });
    savePending(order.orderId, order);

    expect(() => loadPending(order.orderId)).toThrow(
      expect.objectContaining({
        code: 'BIZ_SWAP_EXPIRED',
        message: expect.stringContaining('expired'),
      }),
    );
  });

  it('does not delete expired file (audit retention)', () => {
    const order = makeOrder({
      createdAt: Date.now() - 6 * 60 * 1000,
    });
    savePending(order.orderId, order);

    try {
      loadPending(order.orderId);
    } catch {
      // expected
    }

    // File should still exist on disk
    expect(existsSync(join(tempDir, `${order.orderId}.json`))).toBe(true);
  });

  it('loads successfully within 5-minute window', () => {
    const order = makeOrder({
      createdAt: Date.now() - 4 * 60 * 1000, // 4 min ago
    });
    savePending(order.orderId, order);
    const loaded = loadPending(order.orderId);
    expect(loaded.orderId).toBe(order.orderId);
  });
});

describe('loadPending — not found', () => {
  it('throws BIZ_SWAP_EXPIRED for non-existent orderId', () => {
    expect(() => loadPending('non-existent')).toThrow(
      expect.objectContaining({
        code: 'BIZ_SWAP_EXPIRED',
        message: expect.stringContaining('not found'),
      }),
    );
  });
});

describe('updatePendingStatus', () => {
  it('updates status and updatedAt', () => {
    const order = makeOrder();
    savePending(order.orderId, order);

    const beforeUpdate = Date.now();
    updatePendingStatus(order.orderId, 'executed');

    // loadPending checks expiry, so use a fresh order
    const loaded = loadPending(order.orderId);
    expect(loaded.status).toBe('executed');
    expect(loaded.updatedAt).toBeGreaterThanOrEqual(beforeUpdate);
  });

  it('merges extra fields', () => {
    const order = makeOrder();
    savePending(order.orderId, order);

    updatePendingStatus(order.orderId, 'executed', {
      txHash: '0xDeadBeef',
    });

    const loaded = loadPending(order.orderId);
    expect(loaded.txHash).toBe('0xDeadBeef');
  });

  it('throws for non-existent orderId', () => {
    expect(() => updatePendingStatus('ghost', 'failed')).toThrow(
      expect.objectContaining({
        code: 'BIZ_SWAP_EXPIRED',
      }),
    );
  });
});

describe('listPending', () => {
  it('returns orders sorted by createdAt descending', () => {
    const now = Date.now();
    savePending('a', makeOrder({ orderId: 'a', createdAt: now - 3000 }));
    savePending('b', makeOrder({ orderId: 'b', createdAt: now - 1000 }));
    savePending('c', makeOrder({ orderId: 'c', createdAt: now - 2000 }));

    const list = listPending();
    expect(list.map((o) => o.orderId)).toEqual(['b', 'c', 'a']);
  });

  it('filters by chain', () => {
    savePending('eth1', makeOrder({ orderId: 'eth1', chain: 'eth' }));
    savePending('sol1', makeOrder({ orderId: 'sol1', chain: 'sol' }));
    savePending('eth2', makeOrder({ orderId: 'eth2', chain: 'eth' }));

    const list = listPending({ chain: 'sol' });
    expect(list).toHaveLength(1);
    expect(list[0].chain).toBe('sol');
  });

  it('respects limit', () => {
    for (let i = 0; i < 5; i += 1) {
      savePending(
        `o${i}`,
        makeOrder({ orderId: `o${i}`, createdAt: Date.now() + i }),
      );
    }

    const list = listPending({ limit: 3 });
    expect(list).toHaveLength(3);
  });

  it('returns empty array when no files exist', () => {
    expect(listPending()).toEqual([]);
  });
});

describe('orderId sanitization — path traversal prevention', () => {
  it('strips path traversal characters', () => {
    const order = makeOrder({ orderId: '../../etc/passwd' });
    savePending('../../etc/passwd', order);

    // Traversal chars stripped: "../../etc/passwd" → "etc" + "passwd"
    expect(existsSync(join(tempDir, 'etcpasswd.json'))).toBe(true);
  });

  it('throws for orderId that becomes empty after sanitization', () => {
    expect(() => savePending('/../..', makeOrder())).toThrow(
      expect.objectContaining({
        code: 'PARAM_MISSING_REQUIRED',
        message: expect.stringContaining('empty after sanitization'),
      }),
    );
  });
});
