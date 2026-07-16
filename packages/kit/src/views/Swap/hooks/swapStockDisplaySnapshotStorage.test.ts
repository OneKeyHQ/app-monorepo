import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

import { ESwapStockTradeSide } from './swapStockChannelUtils';
import { swapStockDisplaySnapshotStorage } from './swapStockDisplaySnapshotStorage';

import type { ISwapStockDisplaySnapshot } from './swapStockDisplaySnapshotUtils';

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

function buildSnapshot(
  accountKey: string,
  updatedAt: number,
): ISwapStockDisplaySnapshot {
  return {
    version: 1,
    identity: {
      accountKey,
      stockTokenKey: 'evm--1:0xstock',
      payTokenKey: 'evm--1:0xusdc',
      tradeSide: ESwapStockTradeSide.Buy,
      currency: 'usd',
    },
    updatedAt,
  };
}

describe('swapStockDisplaySnapshotStorage', () => {
  beforeEach(() => {
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
    const snapshotA = buildSnapshot('account-a', 1);
    mockStoredValue = {
      version: 1,
      entries: {
        [encodeURIComponent('account-a')]: {
          snapshot: snapshotA,
          updatedAt: 1,
        },
        bad: null,
      },
    };
    swapStockDisplaySnapshotStorage.reload();

    const snapshotB = buildSnapshot('account-b', 2);
    swapStockDisplaySnapshotStorage.set('account-b', snapshotB);

    expect(swapStockDisplaySnapshotStorage.get('account-a')).toEqual(snapshotA);
    expect(swapStockDisplaySnapshotStorage.get('account-b')).toEqual(snapshotB);
  });
});
