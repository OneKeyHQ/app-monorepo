import type { ICurrencyItem } from '@onekeyhq/shared/types';
import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { buildSwapStockReviewDisplay } from './swapStockReviewUtils';

const currencyMap = {
  usd: {
    id: 'usd',
    unit: '$',
    name: 'US Dollar',
    type: ['fiat'],
    value: '1',
  } as ICurrencyItem,
};

const paymentToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
  price: '1',
  currency: 'usd',
  isNative: false,
};

const stockInfo: IMarketStockInfo = {
  subtitle: 'Apple Inc.',
  sourceLogoUri: '',
  underlyingAssetTicker: 'AAPL',
  tokenToAssetRatio: '0.9985',
};

const stockToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xstock',
  symbol: 'AAPLon',
  decimals: 18,
  isNative: false,
  isStock: true,
  stock: stockInfo,
};

describe('swapStockReviewUtils', () => {
  it('builds estimated shares and effective share price for a buy quote', () => {
    const result = buildSwapStockReviewDisplay({
      currencyMap,
      fromAmount: '100',
      fromToken: paymentToken,
      targetCurrency: 'usd',
      toAmount: '0.3219',
      toToken: stockToken,
    });

    expect(result).toEqual({
      estimatedShares: '0.32141715',
      sharePrice: '311.12216631875430418072',
      underlyingSymbol: 'AAPL',
    });
  });

  it('uses the quoted receive amount when reviewing a stock sale', () => {
    const result = buildSwapStockReviewDisplay({
      currencyMap,
      fromAmount: '0.5',
      fromToken: {
        ...stockToken,
        stock: {
          ...stockInfo,
          tokenToAssetRatio: '1.02',
        },
      },
      targetCurrency: 'usd',
      toAmount: '50',
      toToken: paymentToken,
    });

    expect(result).toEqual({
      estimatedShares: '0.51',
      sharePrice: '98.03921568627450980392',
      underlyingSymbol: 'AAPL',
    });
  });

  it('does not fabricate stock review values without a valid ratio', () => {
    expect(
      buildSwapStockReviewDisplay({
        currencyMap,
        fromAmount: '100',
        fromToken: paymentToken,
        targetCurrency: 'usd',
        toAmount: '0.3219',
        toToken: {
          ...stockToken,
          stock: {
            ...stockInfo,
            tokenToAssetRatio: undefined,
          },
        },
      }),
    ).toBeUndefined();
  });
});
