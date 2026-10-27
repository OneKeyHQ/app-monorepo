import BigNumber from 'bignumber.js';

import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

export function formatSwapTokenTaxPercentage(taxRate?: number) {
  const taxRateBN = new BigNumber(taxRate ?? 0);
  if (!taxRateBN.isFinite() || taxRateBN.lte(0)) {
    return undefined;
  }
  return taxRateBN.multipliedBy(100).toFixed();
}

export function getSwapQuoteTokenTaxPercentages(
  quoteResult?: Pick<IFetchQuoteResult, 'buyTax' | 'sellTax'>,
) {
  return {
    buyTaxPercentage: formatSwapTokenTaxPercentage(quoteResult?.buyTax),
    sellTaxPercentage: formatSwapTokenTaxPercentage(quoteResult?.sellTax),
  };
}
