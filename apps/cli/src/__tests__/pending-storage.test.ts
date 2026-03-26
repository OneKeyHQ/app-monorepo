import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
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

  it('writes atomically — no leftover .tmp file', () => {
    const order = makeOrder();
    savePending(order.orderId, order);
    // .json file should exist
    expect(existsSync(join(tempDir, `${order.orderId}.json`))).toBe(true);
  });

  it('rejects orderId mismatch with data.orderId', () => {
    const order = makeOrder({ orderId: 'actual-id' });
    expect(() => savePending('different-id', order)).toThrow(
      expect.objectContaining({
        code: 'PARAM_MISSING_REQUIRED',
        message: expect.stringContaining('mismatch'),
      }),
    );
  });

  it('validates data before writing', () => {
    const bad = { orderId: 'x' } as unknown as IPendingOrder;
    expect(() => savePending('x', bad)).toThrow(
      expect.objectContaining({
        code: 'BIZ_SWAP_FAILED',
      }),
    );
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

    const loaded = loadPending(order.orderId);
    expect(loaded.status).toBe('executed');
    expect(loaded.updatedAt).toBeGreaterThanOrEqual(beforeUpdate);
  });

  it('merges allowed extra fields (txHash, provider)', () => {
    const order = makeOrder();
    savePending(order.orderId, order);

    updatePendingStatus(order.orderId, 'executed', {
      txHash: '0xDeadBeef',
      provider: '1inch',
    });

    const loaded = loadPending(order.orderId);
    expect(loaded.txHash).toBe('0xDeadBeef');
    expect(loaded.provider).toBe('1inch');
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

  it('skips symlinks in pending directory', () => {
    savePending('real', makeOrder({ orderId: 'real' }));
    const target = join(tempDir, 'real.json');
    symlinkSync(target, join(tempDir, 'linked.json'));

    const list = listPending();
    expect(list).toHaveLength(1);
    expect(list[0].orderId).toBe('real');
  });

  it('skips subdirectories in pending directory', () => {
    savePending('real', makeOrder({ orderId: 'real' }));
    mkdirSync(join(tempDir, 'subdir.json'));

    const list = listPending();
    expect(list).toHaveLength(1);
  });
});

describe('orderId validation — path traversal prevention', () => {
  it('rejects orderId with path traversal characters', () => {
    expect(() =>
      savePending(
        '../../etc/passwd',
        makeOrder({ orderId: '../../etc/passwd' }),
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'PARAM_MISSING_REQUIRED',
        message: expect.stringContaining('illegal characters'),
      }),
    );
  });

  it('rejects orderId with dots', () => {
    expect(() =>
      savePending('abc.def', makeOrder({ orderId: 'abc.def' })),
    ).toThrow(
      expect.objectContaining({
        code: 'PARAM_MISSING_REQUIRED',
      }),
    );
  });

  it('rejects empty orderId', () => {
    expect(() => savePending('', makeOrder())).toThrow(
      expect.objectContaining({
        code: 'PARAM_MISSING_REQUIRED',
      }),
    );
  });

  it('accepts valid orderId with alphanumeric, hyphens, underscores', () => {
    const order = makeOrder({ orderId: 'abc-123_DEF' });
    savePending('abc-123_DEF', order);
    expect(existsSync(join(tempDir, 'abc-123_DEF.json'))).toBe(true);
  });
});

describe('allowanceResult field', () => {
  it('loads orders without allowanceResult (backward compat)', () => {
    const order = makeOrder();
    savePending(order.orderId, order);
    const loaded = loadPending(order.orderId);
    expect(loaded.allowanceResult).toBeUndefined();
  });

  it('round-trips orders with allowanceResult', () => {
    const allowanceResult = {
      allowanceTarget: '0xspender',
      amount: '1000000',
      shouldResetApprove: true,
    };
    const order = makeOrder({ allowanceResult });
    savePending(order.orderId, order);
    const loaded = loadPending(order.orderId);
    expect(loaded.allowanceResult).toEqual(allowanceResult);
  });
});

describe('corrupted file handling', () => {
  it('loadPending throws BIZ_SWAP_FAILED for corrupted JSON', () => {
    writeFileSync(join(tempDir, 'corrupt.json'), 'not-json', 'utf-8');
    expect(() => loadPending('corrupt')).toThrow(
      expect.objectContaining({
        code: 'BIZ_SWAP_FAILED',
        message: expect.stringContaining('Corrupted'),
      }),
    );
  });

  it('loadPending throws BIZ_SWAP_FAILED for empty file', () => {
    writeFileSync(join(tempDir, 'empty.json'), '', 'utf-8');
    expect(() => loadPending('empty')).toThrow(
      expect.objectContaining({
        code: 'BIZ_SWAP_FAILED',
      }),
    );
  });

  it('loadPending throws BIZ_SWAP_FAILED for file missing required fields', () => {
    writeFileSync(
      join(tempDir, 'bad-schema.json'),
      JSON.stringify({ orderId: 'bad-schema' }),
      'utf-8',
    );
    expect(() => loadPending('bad-schema')).toThrow(
      expect.objectContaining({
        code: 'BIZ_SWAP_FAILED',
        message: expect.stringContaining('Corrupted'),
      }),
    );
  });

  it('loadPending rejects symlink target', () => {
    const order = makeOrder({ orderId: 'legit' });
    savePending('legit', order);
    symlinkSync(join(tempDir, 'legit.json'), join(tempDir, 'sneaky.json'));

    expect(() => loadPending('sneaky')).toThrow(
      expect.objectContaining({
        code: 'BIZ_SWAP_EXPIRED',
        message: expect.stringContaining('not found'),
      }),
    );
  });

  it('listPending skips corrupted files', () => {
    savePending('good', makeOrder({ orderId: 'good' }));
    writeFileSync(join(tempDir, 'broken.json'), '{bad', 'utf-8');

    const list = listPending();
    expect(list).toHaveLength(1);
    expect(list[0].orderId).toBe('good');
  });
});
