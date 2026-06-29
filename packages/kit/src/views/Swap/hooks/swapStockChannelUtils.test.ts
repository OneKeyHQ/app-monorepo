import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  ESwapStockTradeSide,
  buildStockSwapTokenFromMarketListToken,
  filterStockPayTokenCandidates,
  resolveStockChannelSwapPair,
  shouldLoadDefaultStockToken,
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
  it('loads the default stock when no stock token has been selected', () => {
    expect(
      shouldLoadDefaultStockToken({
        selectedStockTokenKey: '',
      }),
    ).toBe(true);
  });

  it('does not replace stock-owned state with the default stock', () => {
    expect(
      shouldLoadDefaultStockToken({
        selectedStockTokenKey: appleStockToken.contractAddress ?? '',
      }),
    ).toBe(false);
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

  it('resolves a buy-side stock execution pair from swap selected tokens', () => {
    expect(
      resolveStockChannelSwapPair({
        fromToken: usdcToken,
        toToken: appleStockToken,
      }),
    ).toEqual({
      stockToken: appleStockToken,
      payToken: usdcToken,
      tradeSide: ESwapStockTradeSide.Buy,
    });
  });

  it('resolves a sell-side stock execution pair from swap selected tokens', () => {
    expect(
      resolveStockChannelSwapPair({
        fromToken: appleStockToken,
        toToken: usdtToken,
      }),
    ).toEqual({
      stockToken: appleStockToken,
      payToken: usdtToken,
      tradeSide: ESwapStockTradeSide.Sell,
    });
  });

  it('does not resolve ordinary swap tokens as a stock execution pair', () => {
    expect(
      resolveStockChannelSwapPair({
        fromToken: ethToken,
        toToken: usdcToken,
      }),
    ).toEqual({});
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
  });
});
