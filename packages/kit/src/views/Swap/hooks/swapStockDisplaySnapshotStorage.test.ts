import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';

import { ESwapStockTradeSide } from './swapStockChannelUtils';
import { swapStockDisplaySnapshotStorage } from './swapStockDisplaySnapshotStorage';
import {
  type ISwapStockDisplaySnapshot,
  SWAP_STOCK_DISPLAY_SNAPSHOT_VERSION,
} from './swapStockDisplaySnapshotUtils';

let mockStoredValue: unknown;
const mockSetObject = jest.fn((_key: string, value: unknown) => {
  mockStoredValue = value;
});

jest.mock('@onekeyhq/shared/src/storage/instance/syncStorageInstance', () => ({
  coldStartCacheStorage: {
    getObject: () => mockStoredValue,
    setObject: (key: string, value: unknown) => mockSetObject(key, value),
  },
}));

jest.mock('@onekeyhq/shared/src/storage/coldStartFlushTrigger', () => ({
  registerColdStartFlushTrigger: jest.fn(() => () => undefined),
}));

jest.mock('@onekeyhq/shared/src/utils/resetUtils', () => ({
  __esModule: true,
  default: {
    getIsResetting: jest.fn(() => false),
    getResetGeneration: jest.fn(() => 0),
  },
}));

const mockGetIsResetting = jest.mocked(resetUtils.getIsResetting);
const mockGetResetGeneration = jest.mocked(resetUtils.getResetGeneration);

function buildSnapshot(
  accountKey: string,
  updatedAt: number,
): ISwapStockDisplaySnapshot {
  return {
    version: SWAP_STOCK_DISPLAY_SNAPSHOT_VERSION,
    identity: { accountKey },
    updatedAt,
  };
}

function buildSnapshotWithRuntimeAmount(
  accountKey: string,
  updatedAt: number,
): ISwapStockDisplaySnapshot {
  return {
    ...buildSnapshot(accountKey, updatedAt),
    selection: {
      identity: { accountKey },
      stockToken: {
        networkId: 'evm--56',
        contractAddress: '0xaapl',
        symbol: 'AAPL',
        decimals: 18,
        isStock: true,
      },
      payToken: {
        networkId: 'evm--56',
        contractAddress: '0xusdc',
        symbol: 'USDC',
        decimals: 6,
      },
      tradeSide: ESwapStockTradeSide.Buy,
      updatedAt,
    },
    amount: {
      identity: {
        accountKey,
        stockTokenKey: 'evm--56:0xaapl:token',
        payTokenKey: 'evm--56:0xusdc:token',
        tradeSide: ESwapStockTradeSide.Buy,
        amountSessionId: 0,
      },
      value: '12.5',
      updatedAt,
    },
  };
}

describe('swapStockDisplaySnapshotStorage', () => {
  beforeEach(() => {
    mockGetIsResetting.mockReturnValue(false);
    mockGetResetGeneration.mockReturnValue(0);
    swapStockDisplaySnapshotStorage.flushNow();
    mockStoredValue = undefined;
    swapStockDisplaySnapshotStorage.reload();
    mockSetObject.mockClear();
  });

  it('stores and restores independent account slots under the UI-owned key', () => {
    const snapshotA = buildSnapshot('account-a', 1);
    const snapshotB = buildSnapshot('account-b', 2);

    swapStockDisplaySnapshotStorage.set('account-a', snapshotA);
    swapStockDisplaySnapshotStorage.set('account-b', snapshotB);

    expect(swapStockDisplaySnapshotStorage.get('account-a')).toEqual(snapshotA);
    expect(swapStockDisplaySnapshotStorage.get('account-b')).toEqual(snapshotB);
    expect(mockSetObject).not.toHaveBeenCalled();

    swapStockDisplaySnapshotStorage.flushNow();

    expect(mockSetObject).toHaveBeenLastCalledWith(
      EAppSyncStorageKeys.onekey_swap_stock_display_snapshot,
      expect.objectContaining({ version: 1 }),
    );
  });

  it('keeps amount through same-runtime remounts but omits it from the cold-start checkpoint', () => {
    const snapshot = buildSnapshotWithRuntimeAmount('account-a', 1);

    swapStockDisplaySnapshotStorage.set('account-a', snapshot);
    swapStockDisplaySnapshotStorage.flushNow();

    expect(swapStockDisplaySnapshotStorage.get('account-a')).toEqual(snapshot);
    expect(mockStoredValue).toMatchObject({
      entries: {
        [encodeURIComponent('account-a')]: {
          snapshot: {
            selection: {
              stockToken: { symbol: 'AAPL' },
              payToken: { symbol: 'USDC' },
            },
          },
        },
      },
    });
    expect(
      (
        mockStoredValue as {
          entries: Record<string, { snapshot: ISwapStockDisplaySnapshot }>;
        }
      ).entries[encodeURIComponent('account-a')].snapshot.amount,
    ).toBeUndefined();
  });

  it('drops amount after a process-style storage reload while retaining display selection', () => {
    swapStockDisplaySnapshotStorage.set(
      'account-a',
      buildSnapshotWithRuntimeAmount('account-a', Date.now()),
    );
    swapStockDisplaySnapshotStorage.flushNow();

    swapStockDisplaySnapshotStorage.reload();

    expect(swapStockDisplaySnapshotStorage.get('account-a')).toMatchObject({
      selection: {
        stockToken: { symbol: 'AAPL' },
        payToken: { symbol: 'USDC' },
      },
    });
    expect(
      swapStockDisplaySnapshotStorage.get('account-a')?.amount,
    ).toBeUndefined();
  });

  it('drops an aged display balance on cold start while retaining selection', () => {
    const updatedAt = Date.now() - 2 * 24 * 60 * 60 * 1000;
    const snapshot = {
      ...buildSnapshotWithRuntimeAmount('account-a', updatedAt),
      balance: {
        identity: {
          accountKey: 'account-a',
          inputTokenKey: 'evm--56:0xusdc:token',
        },
        inputTokenKey: 'evm--56:0xusdc:token',
        value: '12.5',
        updatedAt,
      },
    } satisfies ISwapStockDisplaySnapshot;
    mockStoredValue = {
      version: 1,
      entries: {
        [encodeURIComponent('account-a')]: {
          snapshot,
          updatedAt,
        },
      },
    };

    swapStockDisplaySnapshotStorage.reload();

    expect(swapStockDisplaySnapshotStorage.get('account-a')).toMatchObject({
      selection: { payToken: { symbol: 'USDC' } },
      balance: undefined,
    });
  });

  it('ignores legacy persisted amounts during cold-start hydration', () => {
    const snapshot = buildSnapshotWithRuntimeAmount('account-a', Date.now());
    mockStoredValue = {
      version: 1,
      entries: {
        [encodeURIComponent('account-a')]: {
          snapshot,
          updatedAt: snapshot.updatedAt,
        },
      },
    };
    swapStockDisplaySnapshotStorage.reload();

    expect(swapStockDisplaySnapshotStorage.get('account-a')).toMatchObject({
      selection: { stockToken: { symbol: 'AAPL' } },
    });
    expect(
      swapStockDisplaySnapshotStorage.get('account-a')?.amount,
    ).toBeUndefined();
  });

  it('bounds persisted account snapshots and evicts the oldest checkpoint', () => {
    for (let index = 0; index <= 8; index += 1) {
      const accountKey = `account-${index}`;
      swapStockDisplaySnapshotStorage.set(
        accountKey,
        buildSnapshot(accountKey, index + 1),
      );
    }

    expect(swapStockDisplaySnapshotStorage.get('account-0')).toBeUndefined();
    expect(swapStockDisplaySnapshotStorage.get('account-8')).toEqual(
      buildSnapshot('account-8', 9),
    );
  });

  it('treats a corrupt dedicated store as an empty cache', () => {
    mockStoredValue = { version: 999, entries: ['invalid'] };
    swapStockDisplaySnapshotStorage.reload();

    expect(swapStockDisplaySnapshotStorage.get('account-a')).toBeUndefined();
  });

  it('drops one malformed entry without blocking later checkpoints', () => {
    const snapshotA = buildSnapshotWithRuntimeAmount('account-a', Date.now());
    mockStoredValue = {
      version: 1,
      entries: {
        [encodeURIComponent('account-a')]: {
          snapshot: snapshotA,
          updatedAt: snapshotA.updatedAt,
        },
        bad: null,
      },
    };
    swapStockDisplaySnapshotStorage.reload();

    const snapshotB = buildSnapshot('account-b', Date.now() + 1);
    swapStockDisplaySnapshotStorage.set('account-b', snapshotB);

    expect(swapStockDisplaySnapshotStorage.get('account-a')).toEqual({
      ...snapshotA,
      amount: undefined,
    });
    expect(swapStockDisplaySnapshotStorage.get('account-b')).toEqual(snapshotB);
  });

  it('drops unsupported and future persisted snapshots before they can occupy account slots', () => {
    const now = Date.now();
    const validSnapshot = buildSnapshotWithRuntimeAmount('account-a', now);
    const corruptSnapshot = {
      ...buildSnapshotWithRuntimeAmount('corrupt-account', now),
      version: 999,
    };
    const futureSnapshot = buildSnapshotWithRuntimeAmount(
      'future-account',
      now + 60_000,
    );
    mockStoredValue = {
      version: 1,
      entries: {
        [encodeURIComponent('account-a')]: {
          snapshot: validSnapshot,
          updatedAt: now,
        },
        [encodeURIComponent('corrupt-account')]: {
          snapshot: corruptSnapshot,
          updatedAt: Number.MAX_SAFE_INTEGER,
        },
        [encodeURIComponent('future-account')]: {
          snapshot: futureSnapshot,
          updatedAt: Number.MAX_SAFE_INTEGER,
        },
      },
    };
    swapStockDisplaySnapshotStorage.reload();

    expect(
      swapStockDisplaySnapshotStorage.get('corrupt-account'),
    ).toBeUndefined();
    expect(
      swapStockDisplaySnapshotStorage.get('future-account'),
    ).toBeUndefined();
    expect(swapStockDisplaySnapshotStorage.get('account-a')).toMatchObject({
      selection: { stockToken: { symbol: 'AAPL' } },
    });

    const nextSnapshot = buildSnapshot('account-b', now + 1);
    swapStockDisplaySnapshotStorage.set('account-b', nextSnapshot);
    expect(swapStockDisplaySnapshotStorage.get('account-b')).toEqual(
      nextSnapshot,
    );
  });

  it('drops non-canonical persisted slots before bounding account entries', () => {
    const now = Date.now();
    const validSnapshot = buildSnapshotWithRuntimeAmount(
      'account-valid',
      now - 1000,
    );
    const nonCanonicalEntries = Object.fromEntries(
      Array.from({ length: 8 }, (_, index) => {
        const accountKey = `account-misaligned-${index}`;
        const snapshot = buildSnapshotWithRuntimeAmount(accountKey, now);
        return [
          `arbitrary-slot-${index}`,
          { snapshot, updatedAt: snapshot.updatedAt },
        ];
      }),
    );
    mockStoredValue = {
      version: 1,
      entries: {
        ...nonCanonicalEntries,
        [encodeURIComponent('account-valid')]: {
          snapshot: validSnapshot,
          updatedAt: validSnapshot.updatedAt,
        },
      },
    };
    swapStockDisplaySnapshotStorage.reload();

    expect(swapStockDisplaySnapshotStorage.get('account-valid')).toMatchObject({
      selection: { stockToken: { symbol: 'AAPL' } },
    });
    for (let index = 0; index < 8; index += 1) {
      expect(
        swapStockDisplaySnapshotStorage.get(`account-misaligned-${index}`),
      ).toBeUndefined();
    }

    const nextSnapshot = buildSnapshot('account-next', now + 1);
    swapStockDisplaySnapshotStorage.set('account-next', nextSnapshot);
    expect(swapStockDisplaySnapshotStorage.get('account-next')).toEqual(
      nextSnapshot,
    );
  });

  it('discards delayed checkpoints while Reset App owns the UI runtime', () => {
    jest.useFakeTimers();
    try {
      swapStockDisplaySnapshotStorage.set(
        'account-a',
        buildSnapshot('account-a', 1),
      );

      mockGetIsResetting.mockReturnValue(true);
      mockGetResetGeneration.mockReturnValue(1);
      jest.advanceTimersByTime(500);
      mockGetIsResetting.mockReturnValue(false);
      swapStockDisplaySnapshotStorage.flushNow();

      expect(mockSetObject).not.toHaveBeenCalled();
      expect(swapStockDisplaySnapshotStorage.get('account-a')).toBeUndefined();
    } finally {
      mockGetIsResetting.mockReturnValue(false);
      mockGetResetGeneration.mockReturnValue(0);
      jest.useRealTimers();
    }
  });

  it('keeps the old JS runtime disabled after Reset App finishes', () => {
    mockGetIsResetting.mockReturnValue(true);
    mockGetResetGeneration.mockReturnValue(1);
    swapStockDisplaySnapshotStorage.set(
      'account-a',
      buildSnapshot('account-a', 1),
    );
    mockGetIsResetting.mockReturnValue(false);
    swapStockDisplaySnapshotStorage.set(
      'account-b',
      buildSnapshot('account-b', 2),
    );

    expect(swapStockDisplaySnapshotStorage.get('account-a')).toBeUndefined();
    expect(swapStockDisplaySnapshotStorage.get('account-b')).toBeUndefined();
    expect(mockSetObject).not.toHaveBeenCalled();
  });

  it('rejects a pre-reset callback after storage was cleared and reset ended', () => {
    swapStockDisplaySnapshotStorage.set(
      'account-a',
      buildSnapshot('account-a', 1),
    );
    swapStockDisplaySnapshotStorage.flushNow();
    expect(mockSetObject).toHaveBeenCalledTimes(1);

    mockGetIsResetting.mockReturnValue(true);
    mockGetResetGeneration.mockReturnValue(1);
    mockStoredValue = undefined;
    mockGetIsResetting.mockReturnValue(false);
    mockSetObject.mockClear();

    swapStockDisplaySnapshotStorage.set(
      'account-a',
      buildSnapshot('account-a', 2),
    );
    swapStockDisplaySnapshotStorage.flushNow();

    expect(mockSetObject).not.toHaveBeenCalled();
    expect(mockStoredValue).toBeUndefined();
    expect(swapStockDisplaySnapshotStorage.get('account-a')).toBeUndefined();
  });
});
