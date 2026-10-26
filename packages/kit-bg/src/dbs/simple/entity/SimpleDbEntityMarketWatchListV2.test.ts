import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IMarketWatchListDataV2 } from '@onekeyhq/shared/types/market';

import { SimpleDbEntityMarketWatchListV2 } from './SimpleDbEntityMarketWatchListV2';

let mockStored: Record<string, IMarketWatchListDataV2> = {};
let mockFailKey: string | undefined;
let mockSkippedKey: string | undefined;
const mockWriteError = new OneKeyLocalError('write failed');
jest.mock('../base/SimpleDbEntityBase', () => ({
  SimpleDbEntityBase: class {
    entityName!: string;
    async getRawData() {
      return mockStored[this.entityName];
    }
    async setRawData(
      update: (data: IMarketWatchListDataV2) => IMarketWatchListDataV2,
    ) {
      if (mockSkippedKey === this.entityName) return undefined;
      if (mockFailKey === this.entityName) throw mockWriteError;
      mockStored[this.entityName] = update(
        mockStored[this.entityName] ?? { data: [] },
      );
      return mockStored[this.entityName];
    }
  },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    cloudSync: {
      market: {
        simpleDbAddWatchListItems: jest.fn(),
        simpleDbRemoveWatchListItems: jest.fn(),
        simpleDbClearAllWatchListItems: jest.fn(),
      },
    },
  },
}));
const asset = {
  assetId: 'BTC',
  chainId: '',
  contractAddress: '',
  sortIndex: 2,
};
const stock = {
  stockId: 'BTC',
  chainId: '',
  contractAddress: '',
  sortIndex: 3,
};
const perps = {
  perpsCoin: 'BTC',
  chainId: '',
  contractAddress: '',
  sortIndex: 4,
};
const legacy = {
  chainId: 'btc--0',
  contractAddress: '',
  isNative: true,
  sortIndex: 1,
};
beforeEach(() => {
  mockStored = {};
  mockFailKey = undefined;
  mockSkippedKey = undefined;
});
it('persists distinct listing, spot and perps records across entity recreation', async () => {
  const db = new SimpleDbEntityMarketWatchListV2();
  await db.addMarketWatchListV2({
    watchList: [asset, stock, perps, legacy],
    callerName: 'test',
  });
  const reopened = new SimpleDbEntityMarketWatchListV2();
  expect((await reopened.getMarketWatchListV2()).data).toEqual([
    legacy,
    asset,
    stock,
    perps,
  ]);
  expect(await reopened.getMarketWatchListItemV2(stock)).toEqual(stock);
  await reopened.removeMarketWatchListV2({
    items: [stock],
    callerName: 'test',
  });
  expect((await reopened.getMarketWatchListV2()).data).toEqual([
    legacy,
    asset,
    perps,
  ]);
});
it('reorders a listing without colliding with other empty-address records', async () => {
  const db = new SimpleDbEntityMarketWatchListV2();
  await db.addMarketWatchListV2({
    watchList: [asset, stock, perps],
    callerName: 'test',
  });
  await db.addMarketWatchListV2({
    watchList: [{ ...stock, sortIndex: 0 }],
    callerName: 'test',
  });
  expect((await db.getMarketWatchListV2()).data).toEqual([
    { ...stock, sortIndex: 0 },
    asset,
    perps,
  ]);
});
it('rejects invalid identities without discarding valid addressless listings', async () => {
  mockStored.marketWatchListV2 = {
    data: [
      asset,
      stock,
      { chainId: '', contractAddress: '' },
      { ...asset, stockId: 'BTC' },
    ],
  };
  expect(
    (await new SimpleDbEntityMarketWatchListV2().getMarketWatchListV2()).data,
  ).toEqual([asset, stock]);
});

it('keeps new favorites after an old client rewrites or clears its key', async () => {
  const db = new SimpleDbEntityMarketWatchListV2();
  await db.addMarketWatchListV2({
    watchList: [asset, stock, legacy],
    callerName: 'test',
  });
  expect(mockStored.marketWatchListV2.data).toEqual([legacy]);
  expect(mockStored.marketListingWatchList.data).toEqual([asset, stock]);
  // Older clients only see and rewrite the legacy key.
  mockStored.marketWatchListV2 = { data: [perps] };
  const reopened = new SimpleDbEntityMarketWatchListV2();
  expect((await reopened.getMarketWatchListV2()).data).toEqual([
    asset,
    stock,
    perps,
  ]);
  mockStored.marketWatchListV2 = { data: [] };
  expect((await reopened.getMarketWatchListV2()).data).toEqual([asset, stock]);
  await reopened.clearAllMarketWatchListV2();
  expect(
    (await new SimpleDbEntityMarketWatchListV2().getMarketWatchListV2()).data,
  ).toEqual([]);
});

it('migrates existing listings before exposing the legacy key to old clients', async () => {
  mockStored.marketWatchListV2 = { data: [legacy, asset, stock] };
  const db = new SimpleDbEntityMarketWatchListV2();
  expect((await db.getMarketWatchListV2()).data).toEqual([
    legacy,
    asset,
    stock,
  ]);
  expect(mockStored.marketWatchListV2.data).toEqual([legacy]);
  expect(mockStored.marketListingWatchList.data).toEqual([asset, stock]);
});

it.each(['marketListingWatchList', 'marketWatchListV2'])(
  'retries migration after a failed write to %s without losing or duplicating favorites',
  async (key) => {
    mockStored.marketWatchListV2 = { data: [legacy, asset, stock] };
    mockFailKey = key;
    await expect(
      new SimpleDbEntityMarketWatchListV2().getMarketWatchListV2(),
    ).rejects.toThrow('write failed');
    expect(mockStored.marketWatchListV2.data).toEqual([legacy, asset, stock]);
    mockFailKey = undefined;
    const reopened = new SimpleDbEntityMarketWatchListV2();
    expect((await reopened.getMarketWatchListV2()).data).toEqual([
      legacy,
      asset,
      stock,
    ]);
    await reopened.removeMarketWatchListV2({
      items: [asset],
      callerName: 'test',
    });
    expect(
      (await new SimpleDbEntityMarketWatchListV2().getMarketWatchListV2()).data,
    ).toEqual([legacy, stock]);
  },
);

it.each(['marketListingWatchList', 'marketWatchListV2'])(
  'preserves source data when storage skips the %s migration write',
  async (key) => {
    mockStored.marketWatchListV2 = { data: [legacy, asset, stock] };
    mockSkippedKey = key;
    await expect(
      new SimpleDbEntityMarketWatchListV2().getMarketWatchListV2(),
    ).rejects.toThrow('not persisted');
    expect(mockStored.marketWatchListV2.data).toEqual([legacy, asset, stock]);
    mockSkippedKey = undefined;
    expect(
      (await new SimpleDbEntityMarketWatchListV2().getMarketWatchListV2()).data,
    ).toEqual([legacy, asset, stock]);
  },
);
