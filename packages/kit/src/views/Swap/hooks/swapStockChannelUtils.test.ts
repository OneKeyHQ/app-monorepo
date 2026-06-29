import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  ESwapStockTradeSide,
  buildStockChannelEntryKey,
  buildStockSwapTokenFromMarketDetail,
  buildStockSwapTokenFromMarketListToken,
  buildStockSwapTokenFromTokenIdentity,
  filterStockPayTokenCandidates,
  findTokenFromCandidates,
  getMarketPresetTokenKey,
  isCurrentStockMarketDetail,
  isStockMarketDetailMatchedTokenParams,
  resolveStockChannelToken,
  resolveStockExecutionTokenSelection,
} from './swapStockChannelUtils';

const usdcToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
};

const usdtToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdt',
  symbol: 'USDT',
  decimals: 6,
};

const ethToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};

const appleStockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xaapl',
  symbol: 'AAPL',
  decimals: 18,
  isStock: true,
};

describe('swapStockChannelUtils', () => {
  it('builds a distinct entry key for route and market preset identities', () => {
    expect(
      buildStockChannelEntryKey({
        routeStockTokenKey: 'evm--56:0xaapl:token',
        marketPresetTokenKey: '',
      }),
    ).toBe('evm--56:0xaapl:token__');
    expect(
      buildStockChannelEntryKey({
        routeStockTokenKey: 'evm--56:0xmsft:token',
        marketPresetTokenKey: '',
      }),
    ).toBe('evm--56:0xmsft:token__');
    expect(
      buildStockChannelEntryKey({
        routeStockTokenKey: '',
        marketPresetTokenKey: 'evm--56:0xaapl:token',
      }),
    ).toBe('__evm--56:0xaapl:token');
  });

  it('does not resolve an ordinary swap pair token as the stock token', () => {
    expect(
      resolveStockChannelToken({
        stockTokenState: undefined,
        marketStockToken: undefined,
      }),
    ).toBeUndefined();
  });

  it('prefers stock-owned state before market detail stock token', () => {
    expect(
      resolveStockChannelToken({
        stockTokenState: appleStockToken,
        marketStockToken: ethToken,
      }),
    ).toBe(appleStockToken);
  });

  it('falls back to the active market stock token', () => {
    expect(
      resolveStockChannelToken({
        stockTokenState: undefined,
        marketStockToken: appleStockToken,
      }),
    ).toBe(appleStockToken);
  });

  it('falls back to the requested stock identity before detail is available', () => {
    const fallbackStockToken = buildStockSwapTokenFromTokenIdentity({
      networkId: 'evm--56',
      contractAddress: '0xaapl',
      isNative: false,
    });

    expect(fallbackStockToken).toMatchObject({
      networkId: 'evm--56',
      contractAddress: '0xaapl',
      decimals: 0,
      symbol: '',
      isStock: true,
    });
    expect(
      resolveStockChannelToken({
        fallbackStockToken,
        stockTokenState: undefined,
        marketStockToken: undefined,
      }),
    ).toBe(fallbackStockToken);
  });

  it('does not treat an unresolved non-native preset as a stock identity', () => {
    expect(
      getMarketPresetTokenKey({
        networkId: 'evm--56',
        contractAddress: '',
        isNative: false,
      }),
    ).toBe('');
    expect(
      buildStockSwapTokenFromTokenIdentity({
        networkId: 'evm--56',
        contractAddress: '',
        isNative: false,
      }),
    ).toBeUndefined();
    expect(
      getMarketPresetTokenKey({
        networkId: 'evm--56',
        contractAddress: '',
        isNative: true,
      }),
    ).toBe('evm--56::native');
  });

  it('prefers fetched stock detail over a requested identity fallback', () => {
    const fallbackStockToken = buildStockSwapTokenFromTokenIdentity({
      networkId: 'evm--56',
      contractAddress: '0xaapl',
      isNative: false,
    });

    expect(
      resolveStockChannelToken({
        fallbackStockToken,
        stockTokenState: undefined,
        marketStockToken: appleStockToken,
      }),
    ).toBe(appleStockToken);
  });

  it('filters stock pay token candidates to USDC and USDT only', () => {
    expect(
      filterStockPayTokenCandidates([ethToken, usdcToken, usdtToken]).map(
        (token) => token.symbol,
      ),
    ).toEqual(['USDC', 'USDT']);
  });

  it('fails closed when the speed config has no USDC or USDT pay token', () => {
    expect(filterStockPayTokenCandidates([ethToken])).toEqual([]);
  });

  it('matches the active pay token only inside current selectable candidates', () => {
    const currentUsdcToken = {
      ...usdcToken,
      contractAddress: '0xUSDC',
    };

    expect(
      findTokenFromCandidates({
        candidates: [currentUsdcToken],
        token: usdcToken,
      }),
    ).toBe(currentUsdcToken);

    expect(
      findTokenFromCandidates({
        candidates: [usdtToken],
        token: usdcToken,
      }),
    ).toBeUndefined();
  });

  it('restores a buy stock execution pair only when the stock side is explicit', () => {
    expect(
      resolveStockExecutionTokenSelection({
        fromToken: usdcToken,
        toToken: appleStockToken,
      }),
    ).toEqual({
      tradeSide: ESwapStockTradeSide.Buy,
      stockToken: appleStockToken,
      payToken: usdcToken,
    });
  });

  it('restores a sell stock execution pair only when the stock side is explicit', () => {
    expect(
      resolveStockExecutionTokenSelection({
        fromToken: appleStockToken,
        toToken: usdtToken,
      }),
    ).toEqual({
      tradeSide: ESwapStockTradeSide.Sell,
      stockToken: appleStockToken,
      payToken: usdtToken,
    });
  });

  it('does not restore ordinary swap pairs as stock execution pairs', () => {
    expect(
      resolveStockExecutionTokenSelection({
        fromToken: usdcToken,
        toToken: ethToken,
      }),
    ).toBeUndefined();
    expect(
      resolveStockExecutionTokenSelection({
        fromToken: usdcToken,
        toToken: usdtToken,
      }),
    ).toBeUndefined();
  });

  it('marks only stock market tokens as stock swap tokens', () => {
    const stockToken = buildStockSwapTokenFromMarketListToken({
      address: '0xaapl',
      networkId: 'evm--56',
      symbol: 'AAPL',
      name: 'Apple',
      decimals: 18,
      price: '100',
      stock: {
        subtitle: 'Stock',
        sourceLogoUri: '',
        underlyingAssetTicker: 'AAPL',
      },
    });

    expect(stockToken?.isStock).toBe(true);
    expect(stockToken).toMatchObject({
      price: '100',
      currency: 'usd',
    });

    expect(
      buildStockSwapTokenFromMarketListToken({
        address: '0xaapl',
        networkId: 'evm--56',
        symbol: 'AAPL',
        name: 'Apple',
        decimals: 18,
        stock: {
          subtitle: 'Stock',
          sourceLogoUri: '',
          underlyingAssetTicker: 'AAPL',
        },
      })?.isStock,
    ).toBe(true);

    expect(
      buildStockSwapTokenFromMarketDetail({
        tokenDetail: {
          address: '0xusdc',
          networkId: 'evm--56',
          symbol: 'USDC',
          name: 'USDC',
          decimals: 6,
          logoUrl: '',
        },
      })?.isStock,
    ).toBe(false);
  });

  it('keeps market detail stock prices in USD basis for review display', () => {
    expect(
      buildStockSwapTokenFromMarketDetail({
        tokenDetail: {
          address: '0xaapl',
          networkId: 'evm--56',
          symbol: 'AAPL',
          name: 'Apple',
          decimals: 18,
          logoUrl: '',
          price: '100',
          priceConverted: '676',
          stock: {
            subtitle: 'Stock',
            sourceLogoUri: '',
            underlyingAssetTicker: 'AAPL',
          },
        },
      }),
    ).toMatchObject({
      price: '100',
      currency: 'usd',
    });
  });

  it('falls back to market detail address when route token address is empty', () => {
    expect(
      buildStockSwapTokenFromMarketDetail({
        tokenAddress: '',
        tokenDetail: {
          address: '0xaapl',
          networkId: 'evm--56',
          symbol: 'AAPL',
          name: 'Apple',
          decimals: 18,
          logoUrl: '',
          stock: {
            subtitle: 'Stock',
            sourceLogoUri: '',
            underlyingAssetTicker: 'AAPL',
          },
        },
      }),
    ).toMatchObject({
      contractAddress: '0xaapl',
      symbol: 'AAPL',
    });
  });

  it('does not treat a stale non-stock market detail as the current stock detail', () => {
    expect(
      isCurrentStockMarketDetail({
        currentStockToken: {
          networkId: 'evm--56',
          contractAddress: '0xaapl',
          isNative: false,
        },
        networkId: 'btc--0',
        tokenAddress: '',
        isNative: true,
        tokenDetail: {
          networkId: 'btc--0',
          address: '',
          isNative: true,
        },
      }),
    ).toBe(false);
  });

  it('requires the active stock market detail to match the selected stock token', () => {
    expect(
      isCurrentStockMarketDetail({
        currentStockToken: {
          networkId: 'evm--56',
          contractAddress: '0xaapl',
          isNative: false,
        },
        networkId: 'evm--56',
        tokenAddress: '0xother',
        isNative: false,
        tokenDetail: {
          networkId: 'evm--56',
          address: '0xother',
          isNative: false,
          stock: { underlyingAssetTicker: 'OTHER' },
        },
      }),
    ).toBe(false);
  });

  it('accepts the active stock market detail with case-insensitive address match', () => {
    expect(
      isCurrentStockMarketDetail({
        currentStockToken: {
          networkId: 'evm--56',
          contractAddress: '0xAaPl',
          isNative: false,
        },
        networkId: 'evm--56',
        tokenAddress: '0xaapl',
        isNative: false,
        tokenDetail: {
          networkId: 'evm--56',
          address: '0xAAPL',
          isNative: false,
          stock: { underlyingAssetTicker: 'AAPL' },
        },
      }),
    ).toBe(true);
  });

  it('falls back to token detail address when route token address is empty', () => {
    expect(
      isCurrentStockMarketDetail({
        currentStockToken: {
          networkId: 'evm--56',
          contractAddress: '0xaapl',
          isNative: false,
        },
        networkId: 'evm--56',
        tokenAddress: '',
        isNative: false,
        tokenDetail: {
          networkId: 'evm--56',
          address: '0xaapl',
          isNative: false,
          stock: { underlyingAssetTicker: 'AAPL' },
        },
      }),
    ).toBe(true);
  });

  it('does not derive a stock token from stale detail after route switches to a native market token', () => {
    expect(
      isStockMarketDetailMatchedTokenParams({
        networkId: 'btc--0',
        tokenAddress: '',
        isNative: true,
        tokenDetail: {
          networkId: 'evm--56',
          address: '0xaapl',
          isNative: false,
          stock: { underlyingAssetTicker: 'AAPL' },
        },
      }),
    ).toBe(false);
  });

  it('allows route token address fallback when stock detail identity otherwise matches', () => {
    expect(
      isStockMarketDetailMatchedTokenParams({
        networkId: 'evm--56',
        tokenAddress: '',
        isNative: false,
        tokenDetail: {
          networkId: 'evm--56',
          address: '0xaapl',
          isNative: false,
          stock: { underlyingAssetTicker: 'AAPL' },
        },
      }),
    ).toBe(true);
  });
});
