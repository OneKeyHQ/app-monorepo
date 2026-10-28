import { getMarketWatchlistKey } from '@onekeyhq/shared/src/utils/marketWatchlistIdentity';
import type {
  IMarketAssetDetailData,
  IMarketAssetListItem,
  IMarketSearchV2Token,
} from '@onekeyhq/shared/types/market';

import ServiceMarket from './ServiceMarket';

const mockGet = jest.fn();

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
}));
jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class {
    async getClient() {
      return { get: mockGet };
    }
  },
}));

const token: IMarketSearchV2Token = {
  name: 'Ethereum',
  symbol: 'ETH',
  price: '2000',
  address: '',
  network: 'evm--1',
  logoUrl: '',
  isNative: true,
  decimals: 18,
  liquidity: '0',
  volume_24h: '0',
};

const bitcoin: IMarketSearchV2Token = {
  ...token,
  name: 'Bitcoin',
  symbol: 'BTC',
  network: 'btc--0',
  address: 'native',
  decimals: 8,
};
const bitcoinAsset: IMarketAssetListItem = {
  assetId: 'bitcoin',
  symbol: 'BTC',
  logoUrl: '',
  price: '100000',
  priceChange24hPercent: '1',
  priceChange7dPercent: '2',
  marketCap: '2000000',
  volume24h: '1000000',
  sparkline24h: [],
};
const bitcoinDetail: IMarketAssetDetailData = {
  asset: { assetId: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', logoUrl: '' },
  selectedVariant: {
    variantId: 'bitcoin-btc--0-native',
    networkId: 'btc--0',
    tokenAddress: '',
    networkName: 'Bitcoin',
    networkSymbol: 'BTC',
    networkLogoUrl: '',
    isNative: true,
    isDefault: true,
  },
  variants: [],
  about: '',
  market: {
    price: '100000',
    priceChange24h: '1000',
    priceChange24hPercent: '1',
    marketCap: '2000000',
    marketCapRank: 1,
    volume24h: '1000000',
    circulatingSupply: '20',
    fdv: '2100000',
    totalSupply: '21',
    maxSupply: '21',
  },
  performance: {
    priceChange7dPercent: '2',
    price7dAgo: '98000',
    priceChange30dPercent: '3',
    price30dAgo: '97000',
    priceChange3mPercent: '4',
    price3mAgo: '96000',
    priceChange1yPercent: '5',
    price1yAgo: '95000',
    allTimeHighChangePercent: '-10',
    allTimeHighPrice: '110000',
  },
};

beforeEach(() => {
  mockGet.mockReset();
});

function createService(tokens: IMarketSearchV2Token[] = [bitcoin]) {
  const service = new ServiceMarket({ backgroundApi: {} });
  mockGet.mockResolvedValue({ data: { data: tokens } });
  const list = jest
    .spyOn(service, 'fetchMarketAssetList')
    .mockResolvedValue({ list: [bitcoinAsset], total: 1 });
  const detail = jest
    .spyOn(service, 'fetchMarketAssetDetail')
    .mockResolvedValue(bitcoinDetail);
  return { service, list, detail };
}

it.each(['search', 'trending'] as const)(
  '%s shares the Top Coins favorite identity for native BTC without an assetId',
  async (entry) => {
    const { service } = createService();
    const result =
      entry === 'search'
        ? await service.searchV2Token('BTC')
        : await service.fetchTrendingV2();
    expect(result).toEqual([{ ...bitcoin, assetId: 'bitcoin' }]);
    expect(
      getMarketWatchlistKey({
        assetId: result[0].assetId,
        chainId: result[0].network,
        contractAddress: result[0].address,
      }),
    ).toBe(
      getMarketWatchlistKey({
        assetId: bitcoinAsset.assetId,
        chainId: '',
        contractAddress: '',
      }),
    );
  },
);

it.each(['search', 'trending'] as const)(
  '%s preserves backend asset identities and unrelated tokens',
  async (entry) => {
    const tokens = [
      { ...token, assetId: 'eth' },
      {
        ...token,
        symbol: 'USDC',
        address: '0xusdc',
        isNative: false,
        assetId: 'usdc',
      },
      { ...bitcoin, isNative: false, address: '0xbtc' },
      { ...bitcoin, stockId: 'BTC' },
    ];
    const { service, list, detail } = createService(tokens);
    const result =
      entry === 'search'
        ? await service.searchV2Token('ETH')
        : await service.fetchTrendingV2();
    expect(result).toEqual(tokens);
    expect(list).not.toHaveBeenCalled();
    expect(detail).not.toHaveBeenCalled();
  },
);

it('does not assign an asset identity to a same-symbol native coin on another network', async () => {
  const tokens = [{ ...bitcoin, network: 'btc--1' }];
  const { service } = createService(tokens);
  expect(await service.searchV2Token('BTC')).toEqual(tokens);
});

it('keeps search available and retries a failed metadata lookup', async () => {
  const { service, list } = createService();
  list.mockRejectedValueOnce(new Error('offline'));
  expect(await service.searchV2Token('BTC')).toEqual([bitcoin]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(await service.searchV2Token('BTC')).toEqual([
    { ...bitcoin, assetId: 'bitcoin' },
  ]);
});

it('continues after a failed same-symbol candidate and shares cached metadata across searches', async () => {
  const { service, list, detail } = createService();
  list.mockResolvedValue({
    list: [{ ...bitcoinAsset, assetId: 'unavailable-btc' }, bitcoinAsset],
    total: 2,
  });
  detail.mockRejectedValueOnce(new Error('candidate unavailable'));
  expect(await service.searchV2Token('BTC')).toEqual([
    { ...bitcoin, assetId: 'bitcoin' },
  ]);
  expect(await service.fetchTrendingV2()).toEqual([
    { ...bitcoin, assetId: 'bitcoin' },
  ]);
  expect(list).toHaveBeenCalledTimes(1);
  expect(detail).toHaveBeenCalledTimes(2);
});

it.each(['resolve', 'reject'] as const)(
  'bounds metadata waiting and handles a late %s without losing later lookups',
  async (settlement) => {
    jest.useFakeTimers();
    try {
      const { service, detail } = createService();
      let completeDetail: ((value: IMarketAssetDetailData) => void) | undefined;
      let failDetail: ((error: Error) => void) | undefined;
      detail.mockReturnValueOnce(
        new Promise((resolve, reject) => {
          completeDetail = resolve;
          failDetail = reject;
        }),
      );
      const search = service.searchV2Token('BTC');
      await jest.advanceTimersByTimeAsync(2000);
      expect(await search).toEqual([bitcoin]);
      if (settlement === 'resolve') completeDetail?.(bitcoinDetail);
      else failDetail?.(new Error('late metadata failure'));
      await jest.advanceTimersByTimeAsync(1);
      expect(await service.searchV2Token('BTC')).toEqual([
        { ...bitcoin, assetId: 'bitcoin' },
      ]);
    } finally {
      jest.useRealTimers();
    }
  },
);
