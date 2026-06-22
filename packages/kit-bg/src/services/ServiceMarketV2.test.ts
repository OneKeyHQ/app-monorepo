import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import ServiceMarketV2 from './ServiceMarketV2';

type ITestableServiceMarketV2 = {
  _cleanupMarketWatchListV2Data(params: {
    cleanData: IMarketWatchListItemV2[];
    removedItems: IMarketWatchListItemV2[];
  }): Promise<void>;
  _getMarketWatchListV2CleanupSyncDeleteItems(params: {
    cleanData: IMarketWatchListItemV2[];
    removedItems: IMarketWatchListItemV2[];
  }): IMarketWatchListItemV2[];
};

function createServiceForTest(backgroundApi: unknown = {}) {
  return Object.assign(
    Object.create(ServiceMarketV2.prototype) as ServiceMarketV2,
    {
      backgroundApi,
    },
  );
}

async function flushMicrotasks() {
  for (let i = 0; i < 4; i += 1) {
    await Promise.resolve();
  }
}

describe('ServiceMarketV2 watchlist cleanup', () => {
  test('triggers cleanup from read path without exposing dirty data', async () => {
    const cleanData = [
      {
        chainId: 'evm--1',
        contractAddress: '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6',
        sortIndex: 1,
      },
    ];
    const removedItems = [
      {
        chainId: 'evm--1',
        contractAddress: '0xda5e1988097297dcdc1f90d4dfe7909e847cbef6',
        sortIndex: 2,
      },
    ];
    const entity = {
      getMarketWatchListV2CleanupInfo: jest.fn(async () => ({
        cleanData,
        removedItems,
        shouldCleanup: true,
      })),
      markWatchListDataCleaned: jest.fn(),
    };
    const service = createServiceForTest({
      simpleDb: {
        marketWatchListV2: entity,
      },
    });
    const testableService = service as unknown as ITestableServiceMarketV2;
    const cleanupSpy = jest
      .spyOn(testableService, '_cleanupMarketWatchListV2Data')
      .mockResolvedValue(undefined);

    await expect(service.getMarketWatchListV2()).resolves.toEqual({
      data: cleanData,
    });
    await flushMicrotasks();

    expect(entity.markWatchListDataCleaned).toHaveBeenCalledTimes(1);
    expect(cleanupSpy).toHaveBeenCalledWith({
      cleanData,
      removedItems,
    });
  });

  test('dedupes concurrent read-path cleanup while cleanup is in flight', async () => {
    const cleanData = [
      {
        chainId: 'evm--1',
        contractAddress: '',
        isNative: true,
        sortIndex: 1,
      },
    ];
    const removedItems = [
      {
        chainId: 'evm--1',
        contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        isNative: true,
        sortIndex: 2,
      },
    ];
    const entity = {
      getMarketWatchListV2CleanupInfo: jest.fn(async () => ({
        cleanData,
        removedItems,
        shouldCleanup: true,
      })),
      markWatchListDataCleaned: jest.fn(),
    };
    const service = createServiceForTest({
      simpleDb: {
        marketWatchListV2: entity,
      },
    });
    const testableService = service as unknown as ITestableServiceMarketV2;
    let resolveCleanup: () => void = () => undefined;
    const cleanupPromise = new Promise<void>((resolve) => {
      resolveCleanup = resolve;
    });
    const cleanupSpy = jest
      .spyOn(testableService, '_cleanupMarketWatchListV2Data')
      .mockReturnValue(cleanupPromise);

    await expect(
      Promise.all([
        service.getMarketWatchListV2(),
        service.getMarketWatchListV2(),
      ]),
    ).resolves.toEqual([{ data: cleanData }, { data: cleanData }]);

    expect(cleanupSpy).toHaveBeenCalledTimes(1);
    expect(entity.markWatchListDataCleaned).not.toHaveBeenCalled();

    resolveCleanup();
    await flushMicrotasks();

    expect(entity.markWatchListDataCleaned).toHaveBeenCalledTimes(1);
  });

  test('only creates cleanup tombstones for removed items with no retained legacy key', () => {
    const cleanData = [
      {
        chainId: 'evm--1',
        contractAddress: '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6',
        sortIndex: 1,
      },
      {
        chainId: 'evm--1',
        contractAddress: '',
        isNative: true,
        sortIndex: 3,
      },
    ];
    const lowercaseDuplicate = {
      chainId: 'evm--1',
      contractAddress: '0xda5e1988097297dcdc1f90d4dfe7909e847cbef6',
      sortIndex: 2,
    };
    const nativePlaceholderDuplicate = {
      chainId: 'evm--1',
      contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      isNative: true,
      sortIndex: 4,
    };
    const invalidItem = {
      chainId: '',
      contractAddress: '0xinvalid',
      sortIndex: 5,
    };
    const service = createServiceForTest();
    const testableService = service as unknown as ITestableServiceMarketV2;

    expect(
      testableService._getMarketWatchListV2CleanupSyncDeleteItems({
        cleanData,
        removedItems: [
          lowercaseDuplicate,
          nativePlaceholderDuplicate,
          invalidItem,
        ],
      }),
    ).toEqual([nativePlaceholderDuplicate, invalidItem]);

    expect(
      testableService._getMarketWatchListV2CleanupSyncDeleteItems({
        cleanData: [nativePlaceholderDuplicate],
        removedItems: [cleanData[1]],
      }),
    ).toEqual([]);
  });
});
