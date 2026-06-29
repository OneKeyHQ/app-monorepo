import BigNumber from 'bignumber.js';

function toPositiveBigNumber(value?: string | number) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const valueBN = new BigNumber(value);
  return valueBN.isFinite() && valueBN.gt(0) ? valueBN : undefined;
}

function toFiniteBigNumber(value?: string | number) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const valueBN = new BigNumber(value);
  return valueBN.isFinite() ? valueBN : undefined;
}

export function buildRealtimePriceChange24hPercent({
  currentPrice,
  currentPriceChange24hPercent,
  realtimePrice,
}: {
  currentPrice?: string | number;
  currentPriceChange24hPercent?: string | number;
  realtimePrice: string | number;
}) {
  const currentPriceBN = toPositiveBigNumber(currentPrice);
  const currentPriceChange24hPercentBN = toFiniteBigNumber(
    currentPriceChange24hPercent,
  );
  const realtimePriceBN = toPositiveBigNumber(realtimePrice);
  if (!currentPriceBN || !currentPriceChange24hPercentBN || !realtimePriceBN) {
    return undefined;
  }

  const previous24hPriceDenominator = new BigNumber(1).plus(
    currentPriceChange24hPercentBN.div(100),
  );
  if (
    !previous24hPriceDenominator.isFinite() ||
    previous24hPriceDenominator.lte(0)
  ) {
    return undefined;
  }

  const previous24hPrice = currentPriceBN.div(previous24hPriceDenominator);
  if (!previous24hPrice.isFinite() || previous24hPrice.lte(0)) {
    return undefined;
  }

  return realtimePriceBN
    .minus(previous24hPrice)
    .div(previous24hPrice)
    .multipliedBy(100)
    .toFixed();
}
