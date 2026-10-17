import type { IOnramperQuote } from './type';

export type IOnramperQuotePricing = {
  // Fiat that actually buys crypto: the amount paid minus the provider's
  // fees. This is what the payout is worth at the provider's own rate.
  payoutFiatValue: number;
  // Fiat per 1 unit of the destination asset, as implied by the quote. It is
  // the provider's conversion rate with its spread baked in — Onramper does
  // not expose the rate or the spread as fields (confirmed 2026-09-24), and
  // the quote's `rate` is payout/amount, i.e. fees included, so neither can
  // be read off the quote directly.
  impliedPrice: number;
};

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

// Prices a quote the way the provider does: (amount − fees) / payout. Using
// OneKey's market feed instead made "Est. receive (≈$)" disagree with
// "Amount paid − Fees" by the provider's spread (~3% on Coinbase Pay), which
// read as a fee error. Returns undefined when the quote cannot be priced —
// no payout, nothing left after fees, or malformed numbers — so callers hide
// the fiat figures rather than show a different-meaning number.
export function getOnramperQuotePricing({
  amount,
  payout,
  networkFee,
  transactionFee,
}: Pick<IOnramperQuote, 'payout' | 'networkFee' | 'transactionFee'> & {
  // Fiat amount the user pays, in the quote's source currency.
  amount: number;
}): IOnramperQuotePricing | undefined {
  if (
    !Number.isFinite(amount) ||
    !Number.isFinite(payout) ||
    payout <= 0 ||
    !isFiniteNonNegative(networkFee) ||
    !isFiniteNonNegative(transactionFee)
  ) {
    return undefined;
  }
  const payoutFiatValue = amount - networkFee - transactionFee;
  if (payoutFiatValue <= 0) {
    return undefined;
  }
  return {
    payoutFiatValue,
    impliedPrice: payoutFiatValue / payout,
  };
}
