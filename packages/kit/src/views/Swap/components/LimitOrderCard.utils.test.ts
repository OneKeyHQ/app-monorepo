import BigNumber from 'bignumber.js';

import {
  getLimitOrderDisplayAmounts,
  getLimitOrderDisplayPrice,
} from './LimitOrderCard.utils';

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

describe('getLimitOrderDisplayPrice', () => {
  it('aligns a normal rate to the denominating token decimals', () => {
    const price = getLimitOrderDisplayPrice({
      fromAmount: new BigNumber('2'),
      toAmount: new BigNumber('4501.1234567'),
      fromTokenDecimals: 18,
      toTokenDecimals: 6,
    });
    expect(price.toFixed()).toBe('2250.561728');
  });

  it('keeps an ultra-small rate from collapsing to zero', () => {
    // 7,498,440 dmt-nat -> 0.7445 USDC; the raw rate is far below USDC's
    // smallest unit but must stay displayable.
    const price = getLimitOrderDisplayPrice({
      fromAmount: new BigNumber('7498440'),
      toAmount: new BigNumber('0.7445'),
      fromTokenDecimals: 18,
      toTokenDecimals: 6,
    });
    expect(price.isZero()).toBe(false);
    expect(price.toFixed()).toBe('0.0000000992873');
  });

  it('reverses the rate against the from-token decimals', () => {
    const price = getLimitOrderDisplayPrice({
      fromAmount: new BigNumber('7498440'),
      toAmount: new BigNumber('0.7445'),
      fromTokenDecimals: 18,
      toTokenDecimals: 6,
      reverse: true,
    });
    expect(price.toFixed()).toBe('10071779.717931497649429147');
  });

  it('keeps sub-1 rates at full significant precision instead of rounding to token decimals', () => {
    // 0.00123456 must not become 0.001235 (would misstate the order price).
    const price = getLimitOrderDisplayPrice({
      fromAmount: new BigNumber('100'),
      toAmount: new BigNumber('0.123456'),
      fromTokenDecimals: 18,
      toTokenDecimals: 6,
    });
    expect(price.toFixed()).toBe('0.00123456');
  });

  it('does not round a below-smallest-unit rate up to one whole unit', () => {
    // 0.00000065 with 6-decimal USDC used to round up to 0.000001 (+54%).
    const price = getLimitOrderDisplayPrice({
      fromAmount: new BigNumber('1000000'),
      toAmount: new BigNumber('0.65'),
      fromTokenDecimals: 18,
      toTokenDecimals: 6,
    });
    expect(price.toFixed()).toBe('0.00000065');
  });

  it('renders degenerate zero-amount orders as 0 instead of Infinity/NaN', () => {
    const infinite = getLimitOrderDisplayPrice({
      fromAmount: new BigNumber('0'),
      toAmount: new BigNumber('5'),
      fromTokenDecimals: 6,
      toTokenDecimals: 6,
    });
    expect(infinite.toFixed()).toBe('0');
    const nan = getLimitOrderDisplayPrice({
      fromAmount: new BigNumber('0'),
      toAmount: new BigNumber('0'),
      fromTokenDecimals: 6,
      toTokenDecimals: 6,
    });
    expect(nan.toFixed()).toBe('0');
  });
});
