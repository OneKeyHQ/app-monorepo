import { getOnramperQuotePricing } from './quotePricing';

describe('getOnramperQuotePricing', () => {
  // Production order from the 2026-09-23 fee investigation (Coinbase Pay +
  // Apple Pay, $100 → ETH): the fiat left after fees over the quoted payout
  // is the price the provider actually converts at, spread included.
  it('prices the payout with the fiat left after fees', () => {
    const pricing = getOnramperQuotePricing({
      amount: 100,
      payout: 0.034_46,
      networkFee: 0.06,
      transactionFee: 2.44,
    });
    expect(pricing?.payoutFiatValue).toBeCloseTo(97.5, 10);
    expect(pricing?.impliedPrice).toBeCloseTo(2829.37, 2);
  });

  // $50 → ETH order from the same investigation ($1.28 total fee; the split
  // between the two fee kinds is illustrative).
  it('reproduces the $50 order', () => {
    const pricing = getOnramperQuotePricing({
      amount: 50,
      payout: 0.017_11,
      networkFee: 0.04,
      transactionFee: 1.24,
    });
    expect(pricing?.payoutFiatValue).toBeCloseTo(48.72, 10);
    expect(pricing?.impliedPrice).toBeCloseTo(2847.46, 2);
  });

  it('round-trips the mock client rate', () => {
    // mock.ts builds payout as (amount − fees) / rate, so the implied price
    // must recover that rate.
    const rate = 192.94;
    const networkFee = 0.42;
    const transactionFee = 3.99;
    const pricing = getOnramperQuotePricing({
      amount: 100,
      payout: (100 - networkFee - transactionFee) / rate,
      networkFee,
      transactionFee,
    });
    expect(pricing?.impliedPrice).toBeCloseTo(rate, 8);
  });

  it('accepts a zero-fee quote', () => {
    expect(
      getOnramperQuotePricing({
        amount: 10,
        payout: 0.5,
        networkFee: 0,
        transactionFee: 0,
      }),
    ).toEqual({ payoutFiatValue: 10, impliedPrice: 20 });
  });

  it('returns undefined when the quote cannot be priced', () => {
    const base = {
      amount: 100,
      payout: 0.034_46,
      networkFee: 0.06,
      transactionFee: 2.44,
    };
    expect(getOnramperQuotePricing({ ...base, payout: 0 })).toBeUndefined();
    expect(getOnramperQuotePricing({ ...base, amount: 0 })).toBeUndefined();
    // Fees at or above the amount leave nothing to convert.
    expect(
      getOnramperQuotePricing({
        ...base,
        amount: 2.5,
      }),
    ).toBeUndefined();
    expect(
      getOnramperQuotePricing({ ...base, amount: Number.NaN }),
    ).toBeUndefined();
    expect(
      getOnramperQuotePricing({ ...base, networkFee: Number.NaN }),
    ).toBeUndefined();
    expect(
      getOnramperQuotePricing({ ...base, transactionFee: -1 }),
    ).toBeUndefined();
    expect(
      getOnramperQuotePricing({ ...base, payout: Number.POSITIVE_INFINITY }),
    ).toBeUndefined();
    // Finite but tiny payout: the division itself overflows to Infinity.
    expect(
      getOnramperQuotePricing({ ...base, payout: Number.MIN_VALUE }),
    ).toBeUndefined();
  });
});
