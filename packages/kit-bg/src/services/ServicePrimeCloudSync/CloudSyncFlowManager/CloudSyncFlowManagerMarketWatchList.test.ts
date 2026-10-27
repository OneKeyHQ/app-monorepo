import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import { SimpleDbEntityMarketWatchListV2 } from '../../../dbs/simple/entity/SimpleDbEntityMarketWatchListV2';

import { CloudSyncFlowManagerMarketWatchList } from './CloudSyncFlowManagerMarketWatchList';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';
import type { IDBCloudSyncItem } from '../../../dbs/local/types';

let mockItems: Record<string, IMarketWatchListItemV2[]> = {};
jest.mock('../../../dbs/simple/base/SimpleDbEntityBase', () => ({
  SimpleDbEntityBase: class {
    entityName!: string;
    async getRawData() {
      return { data: mockItems[this.entityName] ?? [] };
    }
    async setRawData(
      update: (data: { data: IMarketWatchListItemV2[] }) => {
        data: IMarketWatchListItemV2[];
      },
    ) {
      mockItems[this.entityName] = update({
        data: mockItems[this.entityName] ?? [],
      }).data;
      return { data: mockItems[this.entityName] };
    }
  },
}));
jest.mock('./CloudSyncFlowManagerBase', () => ({
  CloudSyncFlowManagerBase: function MockCloudSyncBase(
    this: { backgroundApi: unknown },
    { backgroundApi }: { backgroundApi: unknown },
  ) {
    this.backgroundApi = backgroundApi;
  },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    cloudSync: {
      market: {
        simpleDbAddWatchListItems: jest.fn(),
        simpleDbRemoveWatchListItems: jest.fn(),
        addWatchList: jest.fn(),
        removeWatchList: jest.fn(),
      },
    },
  },
}));
const asset = { assetId: 'BTC', chainId: '', contractAddress: '' };
const stock = { stockId: 'BTC', chainId: '', contractAddress: '' };
const legacy = { chainId: 'btc--0', contractAddress: '' };
const target = (watchListItem: IMarketWatchListItemV2) => ({
  targetId: 'test',
  dataType: EPrimeCloudSyncDataType.MarketWatchList as const,
  watchListItem,
});
function setup() {
  const db = new SimpleDbEntityMarketWatchListV2();
  return new CloudSyncFlowManagerMarketWatchList({
    backgroundApi: { serviceMarketV2: db } as unknown as IBackgroundApi,
  });
}
beforeEach(() => {
  mockItems = {};
});
it('gives assets and stocks distinct sync keys while retaining the legacy key', async () => {
  const manager = setup();
  expect(await manager.buildSyncRawKey({ target: target(asset) })).toBe(
    'asset:BTC',
  );
  expect(await manager.buildSyncRawKey({ target: target(stock) })).toBe(
    'stock:BTC',
  );
  expect(await manager.buildSyncRawKey({ target: target(legacy) })).toBe(
    'btc--0_',
  );
});
it('round-trips addressless listings through sync and deletes only the selected identity', async () => {
  const manager = setup();
  for (const identity of [asset, stock, legacy]) {
    const payload = await manager.buildSyncPayload({
      target: target(identity),
    });
    expect(
      await manager.syncToSceneEachItem({
        payload,
        target: target(identity),
        item: { isDeleted: false } as IDBCloudSyncItem,
      }),
    ).toBe(true);
  }
  expect(Object.values(mockItems).flat()).toHaveLength(3);
  expect(
    await manager.getDBRecordBySyncPayload({ payload: stock }),
  ).toMatchObject(stock);
  expect(
    await manager.syncToSceneEachItem({
      payload: stock,
      target: target(stock),
      item: { isDeleted: true } as IDBCloudSyncItem,
    }),
  ).toBe(true);
  expect(Object.values(mockItems).flat()).toHaveLength(2);
  expect(
    Object.values(mockItems)
      .flat()
      .some((item) => item.assetId === 'BTC'),
  ).toBe(true);
  expect(
    Object.values(mockItems)
      .flat()
      .some((item) => item.chainId === 'btc--0'),
  ).toBe(true);
});
