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
    ).resolves.toBe(data);

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
});
