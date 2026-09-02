import type { ICurrencyItem } from '@onekeyhq/shared/types';
import { ESwapRateDifferenceUnit } from '@onekeyhq/shared/types/swap/types';

import {
  buildMarketStockQuoteDisplay,
  calculateMarketStockEstimatedShares,
  hasValidMarketStockTokenToAssetRatio,
} from './marketStockQuoteDisplayUtils';

const currencyMap = {
  usd: {
    id: 'usd',
    unit: '$',
    name: 'US Dollar',
    type: ['fiat'],
    value: '1',
  } as ICurrencyItem,
};

describe('marketStockQuoteDisplayUtils', () => {
  it('builds receive fiat value and rate difference from the live quote', () => {
    const result = buildMarketStockQuoteDisplay({
      currencyMap,
      fallbackCurrencySymbol: '$',
      fromToken: {
        networkId: 'evm--1',
        contractAddress: '0xusdc',
        symbol: 'USDC',
        decimals: 6,
        price: '1',
        currency: 'usd',
      },
      toToken: {
        networkId: 'evm--1',
        contractAddress: '0xstock',
        symbol: 'AAPLon',
        decimals: 18,
        price: '310',
        currency: 'usd',
      },
      quoteResult: {
        info: {
          provider: 'liquidMesh',
          providerName: 'liquidMesh',
        },
        fromTokenInfo: {
          networkId: 'evm--1',
          contractAddress: '0xusdc',
          symbol: 'USDC',
          decimals: 6,
        },
        toTokenInfo: {
          networkId: 'evm--1',
          contractAddress: '0xstock',
          symbol: 'AAPLon',
          decimals: 18,
        },
        toAmount: '0.3219',
        instantRate: '0.003219',
      },
      targetCurrency: 'usd',
    });

    expect(result.currencySymbol).toBe('$');
    expect(result.receiveFiatValue).toBe('99.789');
    expect(result.rateDifference).toEqual({
      value: '-0.21%',
      unit: ESwapRateDifferenceUnit.DEFAULT,
    });
  });

  it('calculates shares from the quoted stock token amount and variant ratio', () => {
    expect(
      calculateMarketStockEstimatedShares({
        stockTokenAmount: '0.3219',
        tokenToAssetRatio: '0.9985',
      }),
    ).toBe('0.32141715');
  });

  it('does not assume a one-to-one share ratio when metadata is unavailable', () => {
    expect(
      calculateMarketStockEstimatedShares({
        stockTokenAmount: '0.3219',
      }),
    ).toBeUndefined();
    expect(
      calculateMarketStockEstimatedShares({
        stockTokenAmount: '0.3219',
        tokenToAssetRatio: '0',
      }),
    ).toBeUndefined();
  });

  it('only accepts a positive finite token-to-share ratio', () => {
    expect(hasValidMarketStockTokenToAssetRatio('0.9985')).toBe(true);
    expect(hasValidMarketStockTokenToAssetRatio()).toBe(false);
    expect(hasValidMarketStockTokenToAssetRatio('0')).toBe(false);
    expect(hasValidMarketStockTokenToAssetRatio('NaN')).toBe(false);
  });

  it('treats a payment token fallback price as the selected display currency', () => {
    const cnyCurrencyMap = {
      ...currencyMap,
      cny: {
        id: 'cny',
        unit: '¥',
        name: 'Chinese Yuan',
        type: ['fiat'],
        value: '7',
      } as ICurrencyItem,
    };
    const result = buildMarketStockQuoteDisplay({
      currencyMap: cnyCurrencyMap,
      fallbackCurrencySymbol: '¥',
      fromToken: {
        networkId: 'evm--1',
        contractAddress: '0xstock',
        symbol: 'AAPLon',
        decimals: 18,
        isStock: true,
        price: '100',
        currency: 'usd',
      },
      toToken: {
        networkId: 'evm--1',
        contractAddress: '0xtoken',
        symbol: 'TOKEN',
        decimals: 6,
        price: '7',
      },
      quoteResult: {
        info: {
          provider: 'liquidMesh',
          providerName: 'liquidMesh',
        },
        fromTokenInfo: {
          networkId: 'evm--1',
          contractAddress: '0xstock',
          symbol: 'AAPLon',
          decimals: 18,
        },
        toTokenInfo: {
          networkId: 'evm--1',
          contractAddress: '0xtoken',
          symbol: 'TOKEN',
          decimals: 6,
        },
        toAmount: '10',
      },
      targetCurrency: 'cny',
    });

    expect(result.receiveFiatValue).toBe('70');
  });
});
