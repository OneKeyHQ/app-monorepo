import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { fetchMarketAssetKLineData } from './fetchMarketAssetKLineData';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarket: {
      fetchMarketAssetKline: jest.fn(),
    },
  },
}));

describe('fetchMarketAssetKLineData', () => {
  const serviceMarket = backgroundApiProxy.serviceMarket as unknown as {
    fetchMarketAssetKline: jest.Mock;
  };

  it('loads the self-maintained asset history in USD', async () => {
    const response = {
      pointType: 'single' as const,
      points: [{ o: 1, h: 1, l: 1, c: 1, v: 0, t: 100 }],
      total: 1,
    };
    serviceMarket.fetchMarketAssetKline.mockResolvedValue(response);

    await expect(
      fetchMarketAssetKLineData({
        assetId: 'doge',
        interval: '1h',
        timeFrom: 100,
        timeTo: 200,
      }),
    ).resolves.toEqual(response);
    expect(serviceMarket.fetchMarketAssetKline).toHaveBeenCalledWith({
      assetId: 'doge',
      interval: '1h',
      timeFrom: 100,
      timeTo: 200,
      currency: 'usd',
      autoHandleError: false,
    });
  });
});
