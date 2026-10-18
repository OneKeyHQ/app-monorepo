import type {
  IMarketAssetDetailData,
  IMarketAssetListItem,
  IMarketSearchV2Token,
} from '@onekeyhq/shared/types/market';

import ServiceMarket from './ServiceMarket';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
}));
jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class {
    getClient = jest.fn();
  },
}));

const bitcoin: IMarketAssetListItem = {
  assetId: 'bitcoin',
  symbol: 'BTC',
  logoUrl: 'https://example.com/btc.png',
  price: '100000',
  priceChange24hPercent: '1',
  priceChange7dPercent: '2',
  marketCap: '2000000',
  volume24h: '1000000',
  sparkline24h: [],
};

const bitcoinDetail: IMarketAssetDetailData = {
  about: '',
  asset: {
    assetId: 'bitcoin',
    name: 'Bitcoin',
    symbol: 'BTC',
    logoUrl: 'https://example.com/btc.png',
  },
  variants: [
    {
      variantId: 'bitcoin-evm--1-0xbtc',
      networkId: 'evm--1',
      tokenAddress: '0xBtc',
      networkName: 'Ethereum',
      networkSymbol: 'ETH',
      networkLogoUrl: 'https://example.com/eth.png',
      isNative: false,
      isDefault: false,
    },
  ],
  selectedVariant: {
    variantId: 'bitcoin-btc--0-native',
    networkId: 'btc--0',
    tokenAddress: '',
    networkName: 'Bitcoin',
    networkSymbol: 'BTC',
    networkLogoUrl: 'https://example.com/btc-network.png',
    isNative: true,
    isDefault: true,
  },
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

const native: IMarketSearchV2Token = {
  name: 'Bitcoin',
  symbol: 'BTC',
  price: '100000',
  address: 'native',
  network: 'btc--0',
  logoUrl: '',
  isNative: true,
  decimals: 8,
  liquidity: '0',
  volume_24h: '0',
};

function createService() {
  const service = new ServiceMarket({ backgroundApi: {} });
  const list = jest
    .spyOn(service, 'fetchMarketAssetList')
    .mockResolvedValue({ list: [bitcoin], total: 1 });
  const detail = jest
    .spyOn(service, 'fetchMarketAssetDetail')
    .mockResolvedValue(bitcoinDetail);
  return { service, list, detail };
}

it('shares the top-coins asset identity for native search results', async () => {
  const { service, list, detail } = createService();
  expect(await service.resolveSearchTokenAssets([native])).toEqual([
    { ...native, assetId: 'bitcoin' },
  ]);
  await service.resolveSearchTokenAssets([{ ...native, address: '' }]);
  expect(list).toHaveBeenCalledTimes(1);
  expect(detail).toHaveBeenCalledTimes(1);
});

it('does not merge same-symbol tokens or native coins on unrelated networks', async () => {
  const { service } = createService();
  const wrapped = {
    ...native,
    isNative: false,
    network: 'evm--1',
    address: '0xBtc',
  };
  const otherNative = { ...native, network: 'btc--1' };
  expect(
    await service.resolveSearchTokenAssets([wrapped, otherNative]),
  ).toEqual([wrapped, otherNative]);
});

it('retains verified identities and stock results without metadata lookups', async () => {
  const { service, list } = createService();
  const existing = { ...native, assetId: 'bitcoin' };
  const stock = { ...native, stockId: 'BTC' };
  expect(await service.resolveSearchTokenAssets([existing, stock])).toEqual([
    existing,
    stock,
  ]);
  expect(list).not.toHaveBeenCalled();
});

it('keeps search usable and retries identity lookup after an error', async () => {
  const { service, list } = createService();
  list.mockRejectedValueOnce(new Error('offline'));
  expect(await service.resolveSearchTokenAssets([native])).toEqual([native]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(await service.resolveSearchTokenAssets([native])).toEqual([
    { ...native, assetId: 'bitcoin' },
  ]);
});
