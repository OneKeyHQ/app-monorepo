import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';
import { EUniversalSearchType } from '@onekeyhq/shared/types/search';

import ServiceUniversalSearch from './ServiceUniversalSearch';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
}));
jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class {
    backgroundApi: unknown;
    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

it.each(['failed', 'empty', 'zero-priced'] as const)(
  'normalizes fallback recommendations when trending is %s',
  async (state) => {
    const fetchTrendingV2 = jest.fn<Promise<IMarketSearchV2Token[]>, []>();
    if (state === 'failed')
      fetchTrendingV2.mockRejectedValue(new Error('offline'));
    else if (state === 'empty') fetchTrendingV2.mockResolvedValue([]);
    else
      fetchTrendingV2.mockResolvedValue([
        {
          name: 'Bitcoin',
          symbol: 'BTC',
          price: '0',
          address: '',
          network: 'btc--0',
          logoUrl: '',
          isNative: true,
          decimals: 8,
          liquidity: '0',
          volume_24h: '0',
        },
      ]);
    const resolveSearchTokenAssets = jest.fn(
      async (tokens: IMarketSearchV2Token[]) =>
        tokens.map((token) =>
          token.isNative ? { ...token, assetId: 'bitcoin' } : token,
        ),
    );
    const service = new ServiceUniversalSearch({
      backgroundApi: {
        serviceMarket: { fetchTrendingV2, resolveSearchTokenAssets },
        serviceMarketV2: {
          fetchMarketBasicConfig: jest.fn(async () => ({
            data: {
              networkList: [
                { chainId: 'btc', networkId: 'btc--0' },
                { chainId: 'eth', networkId: 'evm--1' },
              ],
              searchRecommendTokens: [
                {
                  name: 'Bitcoin',
                  symbol: 'BTC',
                  chainId: 'btc',
                  contractAddress: '',
                  isNative: true,
                },
                {
                  name: 'Wrapped Bitcoin',
                  symbol: 'WBTC',
                  chainId: 'eth',
                  contractAddress: '0xbtc',
                  isNative: false,
                },
              ],
            },
          })),
          fetchMarketTokenListBatch: jest.fn(async () => ({
            list: [
              {
                name: 'Bitcoin',
                symbol: 'BTC',
                networkId: 'btc--0',
                address: '',
                price: '100000',
                decimals: 8,
              },
              {
                name: 'Wrapped Bitcoin',
                symbol: 'WBTC',
                networkId: 'evm--1',
                address: '0xbtc',
                price: '100000',
                decimals: 8,
              },
            ],
          })),
        },
      },
    });
    const result = await service.universalSearchRecommend({
      searchTypes: [EUniversalSearchType.V2MarketToken],
    });
    expect(resolveSearchTokenAssets).toHaveBeenCalledWith([
      expect.objectContaining({ network: 'btc--0', isNative: true }),
      expect.objectContaining({
        network: 'evm--1',
        address: '0xbtc',
        isNative: false,
      }),
    ]);
    expect(result[EUniversalSearchType.V2MarketToken]?.items).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ assetId: 'bitcoin', symbol: 'BTC' }),
      }),
      expect.objectContaining({
        payload: expect.not.objectContaining({ assetId: expect.anything() }),
      }),
    ]);
  },
);
