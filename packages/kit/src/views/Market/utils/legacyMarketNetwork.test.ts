import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import {
  getLegacyMarketDetailV2RouteParams,
  getLegacyMarketNavigationTarget,
  getLegacyMarketPrimaryNetwork,
} from './legacyMarketNetwork';

function createDetail(
  overrides: Partial<IMarketTokenDetail>,
): IMarketTokenDetail {
  return {
    name: 'Token',
    image: '',
    symbol: 'TKN',
    about: '',
    explorers: [],
    links: {
      homePageUrl: '',
      discordUrl: '',
      twitterUrl: '',
      whitepaper: '',
      telegramUrl: '',
    },
    stats: {} as IMarketTokenDetail['stats'],
    fallbackToChart: false,
    detailPlatforms: {},
    platforms: {},
    ...overrides,
  };
}

describe('legacyMarketNetwork', () => {
  it('prefers a native platform for native top coins', () => {
    const detail = createDetail({
      symbol: 'ETH',
      detailPlatforms: {
        'evm--10': {
          contract_address: '',
          onekeyNetworkId: 'evm--10',
          isNative: true,
          tokenAddress: '',
        },
        'evm--1': {
          contract_address: '0xToken',
          onekeyNetworkId: 'evm--1',
          tokenAddress: '0xToken',
        },
      },
    });

    expect(getLegacyMarketPrimaryNetwork(detail)?.onekeyNetworkId).toBe(
      'evm--10',
    );
    expect(getLegacyMarketNavigationTarget(detail)).toEqual({
      isNative: true,
      networkId: 'evm--10',
      tokenAddress: '',
    });
  });

  it('matches the primary CoinGecko contract for multi-chain tokens', () => {
    const detail = createDetail({
      symbol: 'USDT',
      platforms: {
        ethereum: '0xPrimary',
        solana: 'Secondary',
      },
      detailPlatforms: {
        'sol--101': {
          contract_address: 'Secondary',
          onekeyNetworkId: 'sol--101',
          tokenAddress: 'Secondary',
        },
        'evm--1': {
          contract_address: '0xPrimary',
          onekeyNetworkId: 'evm--1',
          tokenAddress: '0xPrimary',
        },
      },
    });

    expect(getLegacyMarketNavigationTarget(detail)).toEqual({
      isNative: false,
      networkId: 'evm--1',
      tokenAddress: '0xPrimary',
    });
  });

  it('maps native Hyperliquid HYPE to HyperEVM without V2 polling', () => {
    const detail = createDetail({
      symbol: 'hype',
      platforms: {
        hyperliquid: '0x0d01dc56dcaaca66ad901c959b4011ec',
      },
      detailPlatforms: {},
    });

    expect(getLegacyMarketNavigationTarget(detail)).toEqual({
      decimals: 18,
      isNative: true,
      networkId: 'evm--999',
      skipMarketDataFetch: true,
      tokenAddress: '',
    });
  });

  it('builds a V2 route for a legacy token with a supported identity', () => {
    const detail = createDetail({
      name: 'Ethereum',
      image: 'https://example.com/eth.png',
      symbol: 'eth',
      stats: {
        currentPrice: '2500',
        marketCap: 300_000_000_000,
        volume24h: 12_000_000_000,
        performance: { priceChangePercentage24h: 2.5 },
      } as IMarketTokenDetail['stats'],
      detailPlatforms: {
        'evm--1': {
          contract_address: '',
          onekeyNetworkId: 'evm--1',
          isNative: true,
          tokenAddress: '',
        },
      },
    });

    expect(
      getLegacyMarketDetailV2RouteParams({
        marketTokenId: 'ethereum',
        token: detail,
      }),
    ).toMatchObject({
      disableTrade: false,
      isNative: true,
      marketTokenCategory: 'top_coins',
      marketTokenId: 'ethereum',
      network: 'evm--1',
      showFavoriteButton: true,
      skipMarketDataFetch: false,
      tokenAddress: '',
      legacyTokenPreview: {
        address: '',
        decimals: 18,
        name: 'Ethereum',
        networkId: 'evm--1',
        price: 2500,
        symbol: 'ETH',
      },
    });
  });

  it('keeps an identityless legacy token in the V2 shell', () => {
    const detail = createDetail({
      name: 'Unknown Coin',
      image: 'https://example.com/unknown.png',
      symbol: 'unknown',
      stats: {
        currentPrice: '1.5',
        marketCap: 100,
        volume24h: 20,
        performance: { priceChangePercentage24h: -3 },
      } as IMarketTokenDetail['stats'],
    });

    expect(
      getLegacyMarketDetailV2RouteParams({
        marketTokenId: 'unknown-coin',
        token: detail,
      }),
    ).toMatchObject({
      disableTrade: true,
      isNative: false,
      marketTokenCategory: 'top_coins',
      marketTokenId: 'unknown-coin',
      network: 'coingecko',
      showFavoriteButton: false,
      skipMarketDataFetch: true,
      tokenAddress: 'unknown-coin',
      legacyTokenPreview: {
        address: 'unknown-coin',
        decimals: 0,
        name: 'Unknown Coin',
        networkId: 'coingecko',
        symbol: 'UNKNOWN',
      },
    });
  });
});
