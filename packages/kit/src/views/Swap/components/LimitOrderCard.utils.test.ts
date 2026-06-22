import { getLimitOrderDisplayToAmount } from './LimitOrderCard.utils';

describe('LimitOrderCard utils', () => {
  it('uses the actual executed buy amount when the order has filled', () => {
    expect(
      getLimitOrderDisplayToAmount({
        executedBuyAmount: '4956200',
        toAmount: '4500000',
        toTokenInfo: { decimals: 6 },
      }).toFixed(),
    ).toBe('4.9562');
  });

  it('falls back to the target receive amount before any fill', () => {
    expect(
      getLimitOrderDisplayToAmount({
        executedBuyAmount: '0',
        toAmount: '4500000',
        toTokenInfo: { decimals: 6 },
      }).toFixed(),
    ).toBe('4.5');
  });
});
