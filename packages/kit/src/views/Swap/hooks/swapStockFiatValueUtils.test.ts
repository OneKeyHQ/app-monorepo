import type { ICurrencyItem } from '@onekeyhq/shared/types';

import {
  getStockTokenFiatValue,
  markStockUsdPriceCurrency,
  resolveStockTokenPrice,
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
