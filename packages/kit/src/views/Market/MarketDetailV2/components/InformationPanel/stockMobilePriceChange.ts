import BigNumber from 'bignumber.js';

// The design shows the move with two decimals ("+$9.46") while the derived
// figure carries full precision, so clamp for display — but only above one
// cent. Sub-cent moves keep the price formatter's adaptive precision.
function roundPriceChangeForDisplay(value: BigNumber) {
  return value.abs().gte(0.01) ? value.decimalPlaces(2) : value;
}

export function resolveDisplayedPriceChange({
  price,
  priceChangePercent,
  reportedPriceChangeValue,
}: {
  price?: string;
  priceChangePercent?: string;
  reportedPriceChangeValue?: string;
}): BigNumber | undefined {
  if (reportedPriceChangeValue) {
    const reported = new BigNumber(reportedPriceChangeValue);
    if (reported.isFinite()) {
      return roundPriceChangeForDisplay(reported);
    }
  }
  if (price === undefined || priceChangePercent === undefined) {
    return undefined;
  }
  const priceBN = new BigNumber(price);
  const percentBN = new BigNumber(priceChangePercent);
  if (!priceBN.isFinite() || !percentBN.isFinite()) {
    return undefined;
  }
  const ratio = percentBN.dividedBy(100).plus(1);
  if (ratio.isZero() || !ratio.isFinite()) {
    return undefined;
  }
  return roundPriceChangeForDisplay(priceBN.minus(priceBN.dividedBy(ratio)));
}
