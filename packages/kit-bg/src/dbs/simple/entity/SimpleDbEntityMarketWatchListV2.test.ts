import type { IMarketWatchListDataV2 } from '@onekeyhq/shared/types/market';

import { SimpleDbEntityMarketWatchListV2 } from './SimpleDbEntityMarketWatchListV2';

function setupEntity(initialRawData: IMarketWatchListDataV2) {
  const entity = new SimpleDbEntityMarketWatchListV2();
  let rawData = initialRawData;

  const getRawData = jest
    .spyOn(entity, 'getRawData')
    .mockImplementation(async () => rawData);
  const setRawData = jest
    .spyOn(entity, 'setRawData')
    .mockImplementation(async (dataOrBuilder) => {
      rawData =
        typeof dataOrBuilder === 'function'
          ? await dataOrBuilder(rawData)
          : dataOrBuilder;
      return rawData;
    });

  return {
    entity,
    getRawData,
    setRawData,
    getRawDataValue: () => rawData,
  };
}

describe('SimpleDbEntityMarketWatchListV2', () => {
  test('dedupes EVM checksum/lowercase spot tokens and exposes cleanup data when reading existing watchlist data', async () => {
    const checksumAddressToken = {
      chainId: 'evm--1',
      contractAddress: '0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6',
      sortIndex: 1,
    };
    const duplicatedNativeToken = {
      chainId: 'evm--1',
      contractAddress: '',
      isNative: true,
      sortIndex: 3,
    };
    const { entity, setRawData, getRawDataValue } = setupEntity({
      data: [
        checksumAddressToken,
        {
          chainId: 'evm--1',
          contractAddress: '0xda5e1988097297dcdc1f90d4dfe7909e847cbef6',
          sortIndex: 2,
        },
        duplicatedNativeToken,
        {
          chainId: 'evm--1',
          contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          isNative: true,
          sortIndex: 4,
        },
        {
          chainId: '',
          contractAddress: '0xinvalid',
          sortIndex: 6,
        },
      ],
    });

    await expect(entity.getMarketWatchListV2()).resolves.toEqual({
      data: [checksumAddressToken, duplicatedNativeToken],
    });

    expect(setRawData).not.toHaveBeenCalled();
    await expect(entity.getMarketWatchListV2CleanupInfo()).resolves.toEqual({
      cleanData: [checksumAddressToken, duplicatedNativeToken],
      removedItems: [
        {
          chainId: 'evm--1',
          contractAddress: '0xda5e1988097297dcdc1f90d4dfe7909e847cbef6',
          sortIndex: 2,
        },
        {
          chainId: 'evm--1',
          contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          isNative: true,
          sortIndex: 4,
        },
        {
          chainId: '',
          contractAddress: '0xinvalid',
          sortIndex: 6,
        },
      ],
      shouldCleanup: true,
    });

    await entity.cleanupMarketWatchListV2Data();
    expect(setRawData).toHaveBeenCalledTimes(1);
    expect(getRawDataValue()).toEqual({
      data: [checksumAddressToken, duplicatedNativeToken],
    });
  });

  test('uses normalized item identity when adding watchlist data', async () => {
    const existingPolygonToken = {
      chainId: 'evm--137',
      contractAddress: '0x2222222222222222222222222222222222222222',
      sortIndex: 10,
    };
    const newSpotToken = {
      chainId: 'evm--1',
      contractAddress: '0xabcdef0000000000000000000000000000000001',
      sortIndex: 1,
    };
    const newNativeToken = {
      chainId: 'evm--1',
      contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      isNative: true,
      sortIndex: 2,
    };
    const { entity, getRawDataValue } = setupEntity({
      data: [
        {
          chainId: 'evm--1',
          contractAddress: '0xABCDEF0000000000000000000000000000000001',
          sortIndex: 20,
        },
        {
          chainId: 'evm--1',
          contractAddress: '',
          isNative: true,
          sortIndex: 21,
        },
        existingPolygonToken,
      ],
    });

    await entity.addMarketWatchListV2({
      callerName: 'test',
      watchList: [newSpotToken, newNativeToken],
    });

    expect(getRawDataValue()).toEqual({
      data: [newSpotToken, newNativeToken, existingPolygonToken],
    });
  });

  test('dedupes native recommended tokens with empty address even when isNative is false', async () => {
    const ethFromRecommendedApi = {
      chainId: 'evm--1',
      contractAddress: '',
      isNative: false,
      sortIndex: 1,
    };
    const ethFromNativePath = {
      chainId: 'evm--1',
      contractAddress: '',
      isNative: true,
      sortIndex: 2,
    };
    const bnbFromRecommendedApi = {
      chainId: 'evm--56',
      contractAddress: '',
      isNative: false,
      sortIndex: 3,
    };

    const { entity, getRawDataValue } = setupEntity({
      data: [],
    });

    await entity.addMarketWatchListV2({
      callerName: 'test-recommend',
      watchList: [
        ethFromRecommendedApi,
        ethFromNativePath,
        bnbFromRecommendedApi,
      ],
    });

    expect(getRawDataValue()).toEqual({
      data: [ethFromRecommendedApi, bnbFromRecommendedApi],
    });
  });

  test('uses native-aware identity when getting and removing watchlist data', async () => {
    const nativeToken = {
      chainId: 'evm--1',
      contractAddress: '',
      isNative: true,
      sortIndex: 1,
    };
    const contractToken = {
      chainId: 'evm--1',
      contractAddress: '0xabc0000000000000000000000000000000000000',
      sortIndex: 2,
    };
    const { entity, getRawDataValue } = setupEntity({
      data: [nativeToken, contractToken],
    });

    await expect(
      entity.getMarketWatchListItemV2({
        chainId: 'evm--1',
        contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        isNative: true,
      }),
    ).resolves.toEqual(nativeToken);

    await entity.removeMarketWatchListV2({
      callerName: 'test-native-remove',
      items: [
        {
          chainId: 'evm--1',
          contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          isNative: true,
        },
      ],
    });

    expect(getRawDataValue()).toEqual({
      data: [contractToken],
    });
  });
});
