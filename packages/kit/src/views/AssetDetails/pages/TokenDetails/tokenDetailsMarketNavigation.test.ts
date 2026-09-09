import {
  buildTokenDetailsMarketNavigationTarget,
  shouldHideTokenDetailsMarketFooter,
} from './tokenDetailsMarketNavigation';

describe('buildTokenDetailsMarketNavigationTarget', () => {
  it('preserves the legacy route when a CoinGecko ID is available', () => {
    expect(
      buildTokenDetailsMarketNavigationTarget({
        isNative: false,
        networkId: 'evm--1',
        symbol: 'TOKEN',
        tokenAddress: '0x1234',
        tokenMetadata: {
          coingeckoId: 'legacy-token-id',
          networkId: 'evm--1',
          tokenAddress: '0x1234',
        },
      }),
    ).toEqual({
      type: 'detail',
      token: 'legacy-token-id',
    });
  });

  it('uses the chart route when only a network identity is available', () => {
    expect(
      buildTokenDetailsMarketNavigationTarget({
        isNative: false,
        networkId: 'evm--1',
        networkName: 'Ethereum',
        symbol: 'TOKEN',
        tokenAddress: '0x1234',
        tokenImageUri: 'https://example.com/token.png',
      }),
    ).toEqual({
      type: 'chart',
      isNative: false,
      networkId: 'evm--1',
      networkName: 'Ethereum',
      symbol: 'TOKEN',
      tokenAddress: '0x1234',
      tokenImageUri: 'https://example.com/token.png',
    });
  });

  it('does not use a stale CoinGecko ID from another token', () => {
    expect(
      buildTokenDetailsMarketNavigationTarget({
        isNative: false,
        networkId: 'evm--1',
        symbol: 'TOKEN-B',
        tokenAddress: '0xBBBB',
        tokenMetadata: {
          coingeckoId: 'token-a',
          networkId: 'evm--1',
          tokenAddress: '0xAAAA',
        },
      }),
    ).toEqual({
      type: 'chart',
      isNative: false,
      networkId: 'evm--1',
      symbol: 'TOKEN-B',
      tokenAddress: '0xBBBB',
    });
  });

  it('supports native tokens without a contract address', () => {
    expect(
      buildTokenDetailsMarketNavigationTarget({
        isNative: true,
        networkId: 'custom--native',
        symbol: 'NATIVE',
        tokenAddress: '',
      }),
    ).toEqual({
      type: 'chart',
      isNative: true,
      networkId: 'custom--native',
      symbol: 'NATIVE',
      tokenAddress: '',
    });
  });

  it('keeps native identity when the route uses a placeholder address', () => {
    expect(
      buildTokenDetailsMarketNavigationTarget({
        isNative: true,
        networkId: 'evm--1',
        symbol: 'ETH',
        tokenAddress: '0xeeee',
      }),
    ).toEqual({
      type: 'chart',
      isNative: true,
      networkId: 'evm--1',
      symbol: 'ETH',
      tokenAddress: '0xeeee',
    });
  });

  it('infers a native token from an empty address when isNative is absent', () => {
    expect(
      buildTokenDetailsMarketNavigationTarget({
        networkId: 'custom--native',
        symbol: 'NATIVE',
        tokenAddress: '',
      }),
    ).toEqual({
      type: 'chart',
      isNative: true,
      networkId: 'custom--native',
      symbol: 'NATIVE',
      tokenAddress: '',
    });
  });

  it('keeps the market footer disabled without a routable identity', () => {
    expect(buildTokenDetailsMarketNavigationTarget({})).toBeUndefined();
  });

  it('rejects a non-native token without a contract address', () => {
    expect(
      buildTokenDetailsMarketNavigationTarget({
        isNative: false,
        networkId: 'evm--1',
        symbol: 'TOKEN',
        tokenAddress: '',
      }),
    ).toBeUndefined();
  });
});

describe('shouldHideTokenDetailsMarketFooter', () => {
  it('hides the footer before any market data arrives', () => {
    expect(
      shouldHideTokenDetailsMarketFooter({ tokenMetadata: undefined }),
    ).toBe(true);
  });

  it('keeps the previous member tab data visible while a new tab loads', () => {
    // Aggregate member tabs share one asset; metadata still keyed to the
    // previously active network must not unmount the footer (flash).
    expect(
      shouldHideTokenDetailsMarketFooter({
        tokenMetadata: {
          networkId: 'evm--1',
          tokenAddress: '',
          price: 1840.94,
          priceChange24h: -1.8,
        },
      }),
    ).toBe(false);
  });

  it('hides tokens whose market data is confirmed empty', () => {
    expect(
      shouldHideTokenDetailsMarketFooter({
        tokenMetadata: {
          networkId: 'evm--1',
          tokenAddress: '0x1234',
          price: 0,
          priceChange24h: 0,
        },
      }),
    ).toBe(true);
  });

  it('treats a zero price with a real 24h change as market data', () => {
    expect(
      shouldHideTokenDetailsMarketFooter({
        tokenMetadata: {
          networkId: 'evm--1',
          tokenAddress: '0x1234',
          price: 0,
          priceChange24h: -1.8,
        },
      }),
    ).toBe(false);
  });

  it('treats missing price fields as empty market data', () => {
    expect(
      shouldHideTokenDetailsMarketFooter({
        tokenMetadata: {
          networkId: 'evm--1',
          tokenAddress: '0x1234',
        },
      }),
    ).toBe(true);
  });
});
