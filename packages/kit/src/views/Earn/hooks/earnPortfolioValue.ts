import BigNumber from 'bignumber.js';

/** Ignore missing or non-finite amounts when aggregating portfolio values. */
export const getKnownEarnPortfolioValue = (value?: string): BigNumber => {
  const parsed = new BigNumber(value ?? '0');
  return parsed.isFinite() ? parsed : new BigNumber(0);
};

/** Keep positive unrounded values, including queued assets. */
export const shouldKeepEarnPortfolioInvestment = (value: {
  totalFiatValue?: string;
}): boolean => getKnownEarnPortfolioValue(value.totalFiatValue).gt(0);

/** Apply the same USD threshold to every holding when small assets are hidden. */
export const passesEarnPortfolioSmallAssetsFilter = (value: {
  fiatValueUsd?: string;
}): boolean => getKnownEarnPortfolioValue(value.fiatValueUsd).gte('0.01');

/** Preserve unavailable amounts instead of displaying them as zero. */
export const getEarnPortfolioValueDisplay = (
  value: string | number | undefined,
): string => {
  const parsed = new BigNumber(value ?? Number.NaN);
  return parsed.isFinite() ? parsed.toFixed() : '--';
};
