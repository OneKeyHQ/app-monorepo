import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import ServiceSwap from './ServiceSwap';

describe('ServiceSwap token search', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it('keeps primary search results when the supplemental endpoint fails', async () => {
    const primaryToken: ISwapToken = {
      networkId: 'evm--1',
      contractAddress: '0xprimary',
      decimals: 6,
      symbol: 'PRIMARY',
    };
    const showToast = jest.fn();
    const get = jest.fn((endpoint: string) => {
      if (endpoint === '/swap/v1/tokens') {
        return Promise.resolve({ data: { data: [primaryToken] } });
      }
      return Promise.reject(new Error('supplemental endpoint unavailable'));
    });
    const service = new ServiceSwap({
      backgroundApi: {
        serviceAccountProfile: {
          _getWalletTypeHeader: jest.fn().mockResolvedValue({}),
        },
        serviceApp: { showToast },
      },
    });
    jest.spyOn(service, 'getClient').mockResolvedValue({ get } as never);

    await expect(
      service.fetchSwapTokens({
        networkId: 'evm--1',
        keywords: 'primary',
        onlySwapTokens: true,
        currency: 'usd',
      }),
    ).resolves.toEqual([primaryToken]);
    expect(get).toHaveBeenCalledTimes(2);
    expect(showToast).not.toHaveBeenCalled();
  });
});
