import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IMarketAssetDetailData,
  IMarketAssetListItem,
} from '@onekeyhq/shared/types/market';

import { resolveMarketAssetRouteIdentity } from './resolveMarketAssetRouteIdentity';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarket: {
      fetchMarketAssetDetail: jest.fn(),
      fetchMarketAssetList: jest.fn(),
    },
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

describe('resolveMarketAssetRouteIdentity', () => {
  const serviceMarket = backgroundApiProxy.serviceMarket as jest.Mocked<
    typeof backgroundApiProxy.serviceMarket
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    serviceMarket.fetchMarketAssetList.mockResolvedValue({
      list: [bitcoin],
      total: 1,
    });
    serviceMarket.fetchMarketAssetDetail.mockResolvedValue(bitcoinDetail);
  });

  it('resolves an exact network and contract match to Asset route ids', async () => {
    await expect(
      resolveMarketAssetRouteIdentity({
        networkId: 'evm--1',
        tokenAddress: '0xbtc',
        symbol: 'btc',
        isNative: false,
      }),
    ).resolves.toEqual({
      marketTokenId: 'bitcoin',
      marketVariantId: 'bitcoin-evm--1-0xbtc',
    });

    expect(serviceMarket.fetchMarketAssetList.mock.calls).toContainEqual([
      {
        currency: 'usd',
        limit: 100,
        page: 1,
        type: 'top_coins',
      },
    ]);
  });

  it('does not treat a same-symbol token on another network as the Asset', async () => {
    await expect(
      resolveMarketAssetRouteIdentity({
        networkId: 'sol--101',
        tokenAddress: 'DifferentBitcoinToken',
        symbol: 'BTC',
        isNative: false,
      }),
    ).resolves.toBeUndefined();
  });

  it('matches a native Asset by network even when search returns a placeholder address', async () => {
    await expect(
      resolveMarketAssetRouteIdentity({
        networkId: 'btc--0',
        tokenAddress: 'native',
        symbol: 'BTC',
        isNative: true,
      }),
    ).resolves.toEqual({
      marketTokenId: 'bitcoin',
      marketVariantId: 'bitcoin-btc--0-native',
    });
  });

  it('falls back without throwing when Asset lookup is unavailable', async () => {
    serviceMarket.fetchMarketAssetList.mockRejectedValue(
      new Error('utility unavailable'),
    );

    await expect(
      resolveMarketAssetRouteIdentity({
        networkId: 'btc--0',
        tokenAddress: '',
        symbol: 'BTC',
        isNative: true,
      }),
    ).resolves.toBeUndefined();
  });
});
