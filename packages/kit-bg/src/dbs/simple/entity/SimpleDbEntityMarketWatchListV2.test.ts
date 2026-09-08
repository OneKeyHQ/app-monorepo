import type { IMarketWatchListDataV2 } from '@onekeyhq/shared/types/market';

import { SimpleDbEntityMarketWatchListV2 } from './SimpleDbEntityMarketWatchListV2';

let mockStored: IMarketWatchListDataV2 = { data: [] };
jest.mock('../base/SimpleDbEntityBase', () => ({
  SimpleDbEntityBase: class {
    async getRawData() {
      return mockStored;
    }
    async setRawData(
      update: (data: IMarketWatchListDataV2) => IMarketWatchListDataV2,
    ) {
      mockStored = update(mockStored);
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
  mockStored = { data: [] };
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
  mockStored = {
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
