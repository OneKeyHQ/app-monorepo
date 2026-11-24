import type { ICurrencyItem } from '@onekeyhq/shared/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  getStockTokenFiatValue,
  markStockUsdPriceCurrency,
  resolveStockInputPrice,
  resolveStockTokenPrice,
  resolveStockTradeTokenPrice,
} from './swapStockFiatValueUtils';

const currencyMap: Record<string, ICurrencyItem> = {
  usd: { id: 'usd', unit: '$', name: 'US Dollar', type: ['fiat'], value: '1' },
  cny: {
    id: 'cny',
    unit: '¥',
    name: 'Chinese Yuan',
    type: ['fiat'],
    value: '6.776',
  },
};

describe('swapStockFiatValueUtils', () => {
  it.each([undefined, '0', '-1', 'NaN'])(
    'does not mislabel a USD amount when the target exchange rate is %p',
    (rate) => {
      const target =
        rate === undefined ? undefined : { ...currencyMap.cny, value: rate };
      expect(
        getStockTokenFiatValue({
          amount: '100',
          tokenPrice: { price: '0.98', currency: 'usd' },
          targetCurrency: 'cny',
          currencyMap: {
            usd: currencyMap.usd,
            ...(target ? { cny: target } : {}),
          },
        }),
      ).toBe('--');
    },
  );
  const stockToken: ISwapToken = {
    networkId: 'evm--56',
    contractAddress: '0xstock',
    symbol: 'AAPLon',
    decimals: 18,
    isStock: true,
    stock: { subtitle: '', sourceLogoUri: '', tokenToAssetRatio: '0.9' },
  };
  const stockTokenDetail = {
    networkId: stockToken.networkId,
    address: stockToken.contractAddress,
    price: '10',
  };

  const payToken: ISwapToken = {
    networkId: 'evm--56',
    contractAddress: '0xusdc',
    symbol: 'USDC',
    decimals: 6,
  };

  it('uses a matching quoted pay price before the stablecoin fallback', () => {
    const price = resolveStockInputPrice({
      token: payToken,
      tokenDetail: payToken,
      quoteToken: { ...payToken, price: '0.98' },
      quoteCurrency: 'usd',
    });
    expect(price).toEqual({ price: '0.98', currency: 'usd' });
    expect(
      getStockTokenFiatValue({
        amount: '100',
        tokenPrice: price,
        targetCurrency: 'usd',
        currencyMap,
      }),
    ).toBe('98');
  });

  it.each([undefined, '', '0', '-1', 'NaN', 'Infinity'])(
    'uses the real detail price when the quote price %p is unusable',
    (quotePrice) => {
      expect(
        resolveStockInputPrice({
          token: payToken,
          tokenDetail: { ...payToken, price: '0.995', currency: 'usd' },
          quoteToken: { ...payToken, price: quotePrice },
          quoteCurrency: 'usd',
        }),
      ).toEqual({ price: '0.995', currency: 'usd' });
    },
  );

  it('falls back to one USD when neither quote nor detail has a price', () => {
    expect(
      resolveStockInputPrice({
        token: payToken,
        tokenDetail: payToken,
        quoteToken: payToken,
        quoteCurrency: 'usd',
      }),
    ).toEqual({ price: '1', currency: 'usd' });
  });

  it.each([
    { networkId: 'evm--1', contractAddress: payToken.contractAddress },
    { networkId: payToken.networkId, contractAddress: '0xother' },
  ])('does not use a quoted price from another token: %p', (identity) => {
    expect(
      resolveStockInputPrice({
        token: payToken,
        tokenDetail: { ...payToken, price: '0.995', currency: 'usd' },
        quoteToken: { ...payToken, ...identity, price: '0.2' },
        quoteCurrency: 'usd',
      }),
    ).toEqual({ price: '0.995', currency: 'usd' });
  });

  it('retains the quoted currency when calculating input fiat value', () => {
    const price = resolveStockInputPrice({
      token: payToken,
      quoteToken: { ...payToken, price: '6.64' },
      quoteCurrency: 'cny',
    });
    expect(price).toEqual({ price: '6.64', currency: 'cny' });
    expect(
      getStockTokenFiatValue({
        amount: '10',
        tokenPrice: price,
        targetCurrency: 'cny',
        currencyMap,
      }),
    ).toBe('66.4');
  });

  it('honors an explicit quote currency rather than the request currency', () => {
    expect(
      resolveStockInputPrice({
        token: payToken,
        quoteToken: { ...payToken, price: '0.98', currency: 'usd' },
        quoteCurrency: 'cny',
      }),
    ).toEqual({ price: '0.98', currency: 'usd' });
  });

  it('does not assign the request currency to an untagged quote without a basis', () => {
    expect(
      resolveStockInputPrice({
        token: payToken,
        tokenDetail: { ...payToken, price: '0.995', currency: 'usd' },
        quoteToken: { ...payToken, price: '0.98' },
      }),
    ).toEqual({ price: '0.995', currency: 'usd' });
  });

  it('falls back to the matching stock detail for a sell input without a quote', () => {
    expect(
      resolveStockInputPrice({
        token: stockToken,
        stockTokenDetail,
      }),
    ).toEqual({ price: '10', currency: 'usd' });
  });

  it('does not synthesize a price for a non-stable token without a price source', () => {
    expect(
      resolveStockInputPrice({
        token: { ...payToken, symbol: 'ETH' },
        quoteToken: { ...payToken, symbol: 'ETH' },
        quoteCurrency: 'usd',
      }),
    ).toBeUndefined();
  });

  it.each([
    { currency: 'usd', expected: '20' },
    { currency: 'cny', expected: '135.52' },
  ])(
    'prices a missing-price stock token from its own USD detail in $currency',
    ({ currency, expected }) => {
      const price = resolveStockTradeTokenPrice({
        token: stockToken,
        quoteToken: stockToken,
        quoteCurrency: currency,
        stockTokenDetail,
      });
      expect(price).toEqual({ price: '10', currency: 'usd' });
      expect(
        getStockTokenFiatValue({
          amount: '2',
          tokenPrice: price,
          targetCurrency: currency,
          currencyMap,
        }),
      ).toBe(expected);
      expect(stockToken.price).toBeUndefined();
    },
  );

  it('keeps a matching quote price in its request currency ahead of detail', () => {
    expect(
      resolveStockTradeTokenPrice({
        token: stockToken,
        quoteToken: { ...stockToken, price: '70' },
        quoteCurrency: 'cny',
        stockTokenDetail,
      }),
    ).toEqual({ price: '70', currency: 'cny' });
  });

  it('prefers the pay token price over a stablecoin fallback on quote metadata', () => {
    const quotedPayToken = { ...stockToken, symbol: 'USDC', isStock: false };
    expect(
      resolveStockTradeTokenPrice({
        token: { ...quotedPayToken, price: '0.9995', currency: 'usd' },
        quoteToken: quotedPayToken,
        quoteCurrency: 'usd',
      }),
    ).toEqual({ price: '0.9995', currency: 'usd' });
  });

  it.each([
    { ...stockTokenDetail, networkId: 'evm--1' },
    { ...stockTokenDetail, address: 'another-issuer' },
  ])('rejects the price of another detail identity', (detail) => {
    expect(
      resolveStockTradeTokenPrice({
        token: stockToken,
        stockTokenDetail: detail,
      }),
    ).toBeUndefined();
  });

  it('ignores a quote from another token and uses the current detail', () => {
    expect(
      resolveStockTradeTokenPrice({
        token: stockToken,
        quoteToken: {
          ...stockToken,
          contractAddress: 'another-issuer',
          price: '90',
        },
        quoteCurrency: 'usd',
        stockTokenDetail,
      }),
    ).toEqual({ price: '10', currency: 'usd' });
  });

  it('preserves the selected-token fallback when the detail has no usable price', () => {
    expect(
      resolveStockTradeTokenPrice({
        token: { ...stockToken, price: '12', currency: 'usd' },
        stockTokenDetail: { ...stockTokenDetail, price: '0' },
      }),
    ).toEqual({ price: '12', currency: 'usd' });
  });

  it('keeps untagged quote prices in the current request currency basis', () => {
    const quotePrice = resolveStockTokenPrice({
      token: { price: '100', symbol: 'CRCLon' },
      fallbackCurrency: 'cny',
    });

    expect(
      getStockTokenFiatValue({
        amount: '2',
        tokenPrice: quotePrice,
        targetCurrency: 'cny',
        currencyMap,
      }),
    ).toBe('200');
  });

  it('converts tagged USD stock prices into the selected currency', () => {
    const stockPrice = resolveStockTokenPrice({
      token: { price: '10', currency: 'usd', symbol: 'NVDAon' },
      fallbackCurrency: 'cny',
    });

    expect(
      getStockTokenFiatValue({
        amount: '2',
        tokenPrice: stockPrice,
        targetCurrency: 'cny',
        currencyMap,
      }),
    ).toBe('135.52');
  });

  it('uses USD as the fallback basis for stable pay tokens', () => {
    const payTokenPrice = resolveStockTokenPrice({
      token: { symbol: 'USDC' },
      fallbackCurrency: 'cny',
    });

    expect(payTokenPrice).toEqual({
      price: '1',
      currency: 'usd',
    });
    expect(
      getStockTokenFiatValue({
        amount: '20',
        tokenPrice: payTokenPrice,
        targetCurrency: 'cny',
        currencyMap,
      }),
    ).toBe('135.52');
  });

  it('derives price from balance value using the resolved source currency', () => {
    expect(
      resolveStockTokenPrice({
        token: { balanceParsed: '4', fiatValue: '40', symbol: 'NVDAon' },
        fallbackCurrency: 'usd',
      }),
    ).toEqual({
      price: '10',
      currency: 'usd',
    });
  });

  it('fails closed when a priced token has no known source currency', () => {
    expect(
      resolveStockTokenPrice({
        token: { price: '10', symbol: 'NVDAon' },
      }),
    ).toBeUndefined();
  });

  it('tags USD-fetched priced token details with USD currency', () => {
    expect(
      markStockUsdPriceCurrency({
        networkId: 'evm--56',
        contractAddress: '0xusdc',
        symbol: 'USDC',
        decimals: 6,
        price: '1',
      }),
    ).toMatchObject({
      price: '1',
      currency: 'usd',
    });
  });
});
