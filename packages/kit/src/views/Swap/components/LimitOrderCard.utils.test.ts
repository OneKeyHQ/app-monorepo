import { getLimitOrderDisplayAmounts } from './LimitOrderCard.utils';

describe('LimitOrderCard utils', () => {
  it('uses matching executed sell and buy amounts when the order has filled', () => {
    const result = getLimitOrderDisplayAmounts({
      executedSellAmount: '2000000',
      fromAmount: '10000000',
      fromTokenInfo: { decimals: 6 },
      executedBuyAmount: '4956200',
      toAmount: '4500000',
      toTokenInfo: { decimals: 6 },
    });

    expect(result.displayFromAmount.toFixed()).toBe('2');
    expect(result.displayToAmount.toFixed()).toBe('4.9562');
  });

  it('falls back to the target amounts before any fill', () => {
    const result = getLimitOrderDisplayAmounts({
      executedSellAmount: '0',
      fromAmount: '10000000',
      fromTokenInfo: { decimals: 6 },
      executedBuyAmount: '0',
      toAmount: '4500000',
      toTokenInfo: { decimals: 6 },
    });

    expect(result.displayFromAmount.toFixed()).toBe('10');
    expect(result.displayToAmount.toFixed()).toBe('4.5');
  });

  it('falls back to the target amounts when only one executed side is available', () => {
    const result = getLimitOrderDisplayAmounts({
      executedSellAmount: '0',
      fromAmount: '10000000',
      fromTokenInfo: { decimals: 6 },
      executedBuyAmount: '4956200',
      toAmount: '4500000',
      toTokenInfo: { decimals: 6 },
    });

    expect(result.displayFromAmount.toFixed()).toBe('10');
    expect(result.displayToAmount.toFixed()).toBe('4.5');
  });
});
