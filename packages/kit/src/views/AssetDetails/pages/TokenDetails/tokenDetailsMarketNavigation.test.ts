import { buildTokenDetailsMarketNavigationTarget } from './tokenDetailsMarketNavigation';

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
      networkId: 'custom--native',
      symbol: 'NATIVE',
      tokenAddress: '',
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
