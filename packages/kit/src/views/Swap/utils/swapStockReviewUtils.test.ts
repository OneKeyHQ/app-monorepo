import type { ICurrencyItem } from '@onekeyhq/shared/types';
import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapStockReviewDisplay,
  calculateSwapStockEstimatedShares,
  getValidStockTokenToAssetRatio,
  resolveStockTokenToAssetRatio,
  resolveSwapStockReviewToken,
} from './swapStockReviewUtils';

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
  it.each([undefined, '', '  ', '0', '-1', 'NaN', 'Infinity', 'invalid'])(
    'rejects unavailable conversion ratio %p for display and calculation',
    (ratio) => {
      expect(getValidStockTokenToAssetRatio(ratio)).toBeUndefined();
      expect(
        calculateSwapStockEstimatedShares({
          stockTokenAmount: '2',
          tokenToAssetRatio: ratio,
        }),
      ).toBeUndefined();
    },
  );

  it('preserves valid ratio precision while trimming whitespace', () => {
    const ratio = '0.12345678901234567890123456789';
    expect(getValidStockTokenToAssetRatio(`  ${ratio}  `)).toBe(ratio);
    expect(
      calculateSwapStockEstimatedShares({
        stockTokenAmount: '2',
        tokenToAssetRatio: `  ${ratio}  `,
      }),
    ).toBe('0.24691357802469135780246913578');
  });

  it('does not reuse a stale token-detail ratio for another selected variant', () => {
    expect(
      resolveStockTokenToAssetRatio({
        selectedVariantRatio: '0',
        tokenDetailRatio: '0.9985',
        hasSelectedVariant: true,
        selectedVariantMatchesTokenDetail: false,
      }),
    ).toBeUndefined();
  });

  it.each([
    { hasSelectedVariant: false, selectedVariantMatchesTokenDetail: false },
    { hasSelectedVariant: true, selectedVariantMatchesTokenDetail: true },
  ])(
    'allows the token-detail ratio for the current identity: %o',
    ({ hasSelectedVariant, selectedVariantMatchesTokenDetail }) => {
      expect(
        resolveStockTokenToAssetRatio({
          selectedVariantRatio: '0',
          tokenDetailRatio: '0.9985',
          hasSelectedVariant,
          selectedVariantMatchesTokenDetail,
        }),
      ).toBe('0.9985');
    },
  );

  it('prefers the matching variant ratio when token detail omits or disagrees with it', () => {
    for (const detailRatio of [undefined, '0.9']) {
      const result = resolveSwapStockReviewToken({
        stockToken,
        selectedTokenVariant: { ...stockToken, tokenToAssetRatio: '1' },
        tokenDetail: {
          networkId: stockToken.networkId,
          address: stockToken.contractAddress,
          stock: { ...stockInfo, tokenToAssetRatio: detailRatio },
        },
        underlyingSymbol: 'AAPL',
      });
      expect(result?.stock?.tokenToAssetRatio).toBe('1');
      expect(result?.stock?.underlyingAssetTicker).toBe('AAPL');
    }
  });

  it.each(['', '0', '-1', 'NaN', 'Infinity'])(
    'falls back to matching detail when Market config and variant ratio are invalid: %p',
    (ratio) => {
      const result = resolveSwapStockReviewToken({
        stockToken,
        selectedTokenVariant: { ...stockToken, tokenToAssetRatio: ratio },
        tokenDetail: {
          address: stockToken.contractAddress,
          stock: stockInfo,
        },
        stockTradeConfig: { tokenToAssetRatio: ratio },
      });
      expect(result?.stock?.tokenToAssetRatio).toBe('0.9985');
    },
  );

  it.each([
    { networkId: 'evm--56', contractAddress: stockToken.contractAddress },
    { networkId: stockToken.networkId, contractAddress: '0xother' },
  ])(
    'does not use a leading variant or Market config for another identity: %o',
    (identity) => {
      const result = resolveSwapStockReviewToken({
        stockToken,
        selectedTokenVariant: { ...identity, tokenToAssetRatio: '2' },
        tokenDetail: {
          networkId: stockToken.networkId,
          address: stockToken.contractAddress,
          stock: stockInfo,
        },
        stockTradeConfig: {
          tokenToAssetRatio: '3',
          underlyingSymbol: 'OTHER',
        },
      });
      expect(result?.stock?.tokenToAssetRatio).toBeUndefined();
      expect(result?.stock?.underlyingAssetTicker).toBe('AAPL');
    },
  );

  it.each([
    { networkId: 'evm--56', address: stockToken.contractAddress },
    { networkId: stockToken.networkId, address: '0xother' },
  ])(
    'rejects detail for another identity instead of retaining a cached ratio: %o',
    (identity) => {
      const result = resolveSwapStockReviewToken({
        stockToken,
        selectedTokenVariant: { ...stockToken, tokenToAssetRatio: undefined },
        tokenDetail: { ...identity, stock: stockInfo },
      });
      expect(result?.stock?.tokenToAssetRatio).toBeUndefined();
    },
  );

  it('uses fresh detail before variants arrive and clears a withdrawn ratio', () => {
    const resolvedToken = resolveSwapStockReviewToken({
      stockToken,
      tokenDetail: { address: stockToken.contractAddress, stock: stockInfo },
    });
    expect(resolvedToken?.stock?.tokenToAssetRatio).toBe('0.9985');
    const clearedToken = resolveSwapStockReviewToken({
      stockToken: resolvedToken,
      tokenDetail: {
        address: stockToken.contractAddress,
        stock: { ...stockInfo, tokenToAssetRatio: undefined },
      },
    });
    expect(clearedToken?.stock).toHaveProperty('tokenToAssetRatio', undefined);
    expect(stockToken.stock?.tokenToAssetRatio).toBe('0.9985');
  });

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
