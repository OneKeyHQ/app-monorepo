import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';

import {
  fetchMarketAssetListLight,
  fetchMarketTokenListBatchLight,
} from './marketLightApi';

const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('@onekeyhq/shared/src/appApiClient/appApiClient', () => ({
  appApiClient: {
    getClient: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/config/endpointsMap', () => ({
  getEndpointByServiceName: jest.fn(() => 'https://utility.example.com'),
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: {
      locale: 'zh-CN',
    },
  },
}));

jest.mock('./marketPerf', () => ({
  markMarketPerf: jest.fn(),
}));

describe('marketLightApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(appApiClient.getClient).mockResolvedValue({
      get: mockGet,
      post: mockPost,
    } as unknown as Awaited<ReturnType<typeof appApiClient.getClient>>);
  });

  it('fetches Top Coins without the background API', async () => {
    const data = { list: [], total: 0 };
    mockGet.mockResolvedValueOnce({ data: { data } });

    await expect(
      fetchMarketAssetListLight({
        currency: 'usd',
        limit: 100,
        page: 1,
        type: 'top_coins_test',
      }),
    ).resolves.toBe(data);

    expect(mockGet).toHaveBeenCalledWith('/utility/v1/market/asset/list', {
      params: {
        currency: 'usd',
        limit: 100,
        page: 1,
        type: 'top_coins_test',
      },
    });
  });

  it('fetches a watchlist batch without the background API', async () => {
    const data = { list: [] };
    const tokenAddressList = [
      {
        chainId: 'evm--1',
        contractAddress: '0xtoken-test',
        isNative: false,
      },
    ];
    mockPost.mockResolvedValueOnce({ data: { data } });

    await expect(
      fetchMarketTokenListBatchLight({ tokenAddressList }),
    ).resolves.toEqual(data);

    expect(mockPost).toHaveBeenCalledWith(
      '/utility/v2/market/token/list/batch',
      {
        tokenAddressList,
        currency: 'usd',
      },
      {
        headers: {
          'x-onekey-request-currency': 'usd',
          'x-onekey-request-locale': 'zh-cn',
        },
      },
    );
  });

  it('caches successful batch rows individually and retries missing rows', async () => {
    const firstToken = {
      chainId: 'evm--cache-test',
      contractAddress: '0xfirst-cache-test',
      isNative: false,
    };
    const secondToken = {
      chainId: 'evm--cache-test',
      contractAddress: '0xsecond-cache-test',
      isNative: false,
    };
    const firstItem = {
      address: firstToken.contractAddress,
      networkId: firstToken.chainId,
      isNative: false,
      symbol: 'FIRST',
    };
    const secondItem = {
      address: secondToken.contractAddress,
      networkId: secondToken.chainId,
      isNative: false,
      symbol: 'SECOND',
    };
    mockPost
      .mockResolvedValueOnce({ data: { data: { list: [secondItem] } } })
      .mockResolvedValueOnce({ data: { data: { list: [firstItem] } } });

    const partialResult = await fetchMarketTokenListBatchLight({
      tokenAddressList: [firstToken, secondToken],
    });
    expect(partialResult.list).toHaveLength(2);
    expect(partialResult.list[0]).toBeUndefined();
    expect(partialResult.list[1]).toEqual(secondItem);
    await expect(
      fetchMarketTokenListBatchLight({
        tokenAddressList: [firstToken, secondToken],
      }),
    ).resolves.toEqual({ list: [firstItem, secondItem] });
    await expect(
      fetchMarketTokenListBatchLight({
        tokenAddressList: [secondToken, firstToken],
      }),
    ).resolves.toEqual({ list: [secondItem, firstItem] });

    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(mockPost.mock.calls[1]?.[1]).toEqual({
      tokenAddressList: [firstToken],
      currency: 'usd',
    });
  });

  it('includes the normalized locale in each token cache key', async () => {
    const token = {
      chainId: 'evm--locale-cache-test',
      contractAddress: '0xlocale-cache-test',
      isNative: false,
    };
    const zhItem = {
      address: token.contractAddress,
      networkId: token.chainId,
      isNative: false,
      symbol: 'ZH',
    };
    const enItem = {
      address: token.contractAddress,
      networkId: token.chainId,
      isNative: false,
      symbol: 'EN',
    };
    mockPost
      .mockResolvedValueOnce({ data: { data: { list: [zhItem] } } })
      .mockResolvedValueOnce({ data: { data: { list: [enItem] } } });

    await fetchMarketTokenListBatchLight({
      tokenAddressList: [token],
      requestLocale: 'zh-CN',
    });
    await expect(
      fetchMarketTokenListBatchLight({ tokenAddressList: [token] }),
    ).resolves.toEqual({ list: [zhItem] });
    await expect(
      fetchMarketTokenListBatchLight({
        tokenAddressList: [token],
        requestLocale: 'en-US',
      }),
    ).resolves.toEqual({ list: [enItem] });

    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(mockPost.mock.calls[1]?.[2]).toEqual({
      headers: {
        'x-onekey-request-currency': 'usd',
        'x-onekey-request-locale': 'en-us',
      },
    });
  });

  it('matches a native response without network identity to its unique request', async () => {
    const token = {
      chainId: 'evm--native-cache-test',
      contractAddress: '0xnative',
      isNative: true,
    };
    const item = {
      address: token.contractAddress,
      name: 'Native Token',
      symbol: 'NATIVE',
      decimals: 18,
    };
    mockPost.mockResolvedValueOnce({ data: { data: { list: [item] } } });

    await expect(
      fetchMarketTokenListBatchLight({ tokenAddressList: [token] }),
    ).resolves.toEqual({
      list: [{ ...item, isNative: true, networkId: token.chainId }],
    });
    await expect(
      fetchMarketTokenListBatchLight({ tokenAddressList: [token] }),
    ).resolves.toEqual({
      list: [{ ...item, isNative: true, networkId: token.chainId }],
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('pairs multiple anonymous native rows by preserved API order', async () => {
    const firstToken = {
      chainId: 'evm--first-native-cache-test',
      contractAddress: '',
      isNative: true,
    };
    const secondToken = {
      chainId: 'sol--second-native-cache-test',
      contractAddress: '',
      isNative: true,
    };
    const firstItem = {
      address: '',
      name: 'First Native Token',
      symbol: 'FIRST',
      decimals: 18,
    };
    const secondItem = {
      address: '',
      name: 'Second Native Token',
      symbol: 'SECOND',
      decimals: 9,
    };
    mockPost.mockResolvedValueOnce({
      data: { data: { list: [firstItem, secondItem] } },
    });

    const firstNormalizedItem = {
      ...firstItem,
      isNative: true,
      networkId: firstToken.chainId,
    };
    const secondNormalizedItem = {
      ...secondItem,
      isNative: true,
      networkId: secondToken.chainId,
    };
    await expect(
      fetchMarketTokenListBatchLight({
        tokenAddressList: [firstToken, secondToken],
      }),
    ).resolves.toEqual({ list: [firstNormalizedItem, secondNormalizedItem] });
    await expect(
      fetchMarketTokenListBatchLight({
        tokenAddressList: [secondToken, firstToken],
      }),
    ).resolves.toEqual({ list: [secondNormalizedItem, firstNormalizedItem] });

    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('does not cache incomplete anonymous native rows by response index', async () => {
    const firstNativeToken = {
      chainId: 'evm--first-incomplete-native-test',
      contractAddress: '',
      isNative: true,
    };
    const spotToken = {
      chainId: 'evm--incomplete-native-test',
      contractAddress: '0xspot-incomplete-native-test',
      isNative: false,
    };
    const secondNativeToken = {
      chainId: 'sol--second-incomplete-native-test',
      contractAddress: '',
      isNative: true,
    };
    const spotItem = {
      address: spotToken.contractAddress,
      networkId: spotToken.chainId,
      isNative: false,
      symbol: 'SPOT',
    };
    const firstNativeItem = {
      address: '',
      symbol: 'FIRST_NATIVE',
    };
    const secondNativeItem = {
      address: '',
      symbol: 'SECOND_NATIVE',
    };
    mockPost
      .mockResolvedValueOnce({
        data: { data: { list: [spotItem, secondNativeItem] } },
      })
      .mockResolvedValueOnce({
        data: { data: { list: [firstNativeItem, secondNativeItem] } },
      });
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const partialResult = await fetchMarketTokenListBatchLight({
      tokenAddressList: [firstNativeToken, spotToken, secondNativeToken],
    });
    expect(partialResult.list).toHaveLength(2);
    expect(partialResult.list[0]).toBeUndefined();
    expect(partialResult.list[1]).toEqual(spotItem);
    expect(partialResult.list[2]).toBeUndefined();

    const firstNormalizedItem = {
      ...firstNativeItem,
      isNative: true,
      networkId: firstNativeToken.chainId,
    };
    const secondNormalizedItem = {
      ...secondNativeItem,
      isNative: true,
      networkId: secondNativeToken.chainId,
    };
    await expect(
      fetchMarketTokenListBatchLight({
        tokenAddressList: [firstNativeToken, secondNativeToken],
      }),
    ).resolves.toEqual({ list: [firstNormalizedItem, secondNormalizedItem] });
    await expect(
      fetchMarketTokenListBatchLight({
        tokenAddressList: [secondNativeToken, firstNativeToken],
      }),
    ).resolves.toEqual({ list: [secondNormalizedItem, firstNormalizedItem] });

    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(mockPost.mock.calls[1]?.[1]).toEqual({
      tokenAddressList: [firstNativeToken, secondNativeToken],
      currency: 'usd',
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[marketLightApi] fetchMarketTokenListBatchLight: ambiguous anonymous native response rows',
      { requestCount: 2, responseCount: 1 },
    );
    consoleErrorSpy.mockRestore();
  });

  it('does not let an older response overwrite a newer batch cache entry', async () => {
    const token = {
      chainId: 'evm--concurrent-cache-test',
      contractAddress: '0xconcurrent-cache-test',
      isNative: false,
    };
    const olderItem = {
      address: token.contractAddress,
      networkId: token.chainId,
      isNative: false,
      symbol: 'OLDER',
    };
    const newerItem = {
      ...olderItem,
      symbol: 'NEWER',
    };
    let resolveOlderRequest:
      | ((value: { data: { data: { list: (typeof olderItem)[] } } }) => void)
      | undefined;
    const olderRequest = new Promise<{
      data: { data: { list: (typeof olderItem)[] } };
    }>((resolve) => {
      resolveOlderRequest = resolve;
    });
    mockPost
      .mockImplementationOnce(() => olderRequest)
      .mockResolvedValueOnce({ data: { data: { list: [newerItem] } } });

    const olderResultPromise = fetchMarketTokenListBatchLight({
      tokenAddressList: [token],
      skipCache: true,
    });
    const newerResultPromise = fetchMarketTokenListBatchLight({
      tokenAddressList: [token],
      skipCache: true,
    });

    await expect(newerResultPromise).resolves.toEqual({ list: [newerItem] });
    resolveOlderRequest?.({ data: { data: { list: [olderItem] } } });
    await expect(olderResultPromise).resolves.toEqual({ list: [newerItem] });
    await expect(
      fetchMarketTokenListBatchLight({ tokenAddressList: [token] }),
    ).resolves.toEqual({ list: [newerItem] });

    expect(mockPost).toHaveBeenCalledTimes(2);
  });
});
