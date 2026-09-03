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
});
