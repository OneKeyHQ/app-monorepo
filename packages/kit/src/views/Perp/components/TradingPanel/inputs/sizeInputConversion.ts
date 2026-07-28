import BigNumber from 'bignumber.js';

import { formatHlSize } from '@onekeyhq/shared/src/utils/perpsUtils';

export function convertPerpsSizeDisplayValueToToken({
  displayValue,
  inputMode,
  referencePrice,
  leverage,
  szDecimals,
}: {
  displayValue: string;
  inputMode: 'usd' | 'margin';
  referencePrice: string;
  leverage: number;
  szDecimals: number;
}) {
  const displayValueBN = new BigNumber(displayValue);
  const referencePriceBN = new BigNumber(referencePrice);
  if (
    !displayValueBN.isFinite() ||
    !referencePriceBN.isFinite() ||
    !referencePriceBN.gt(0)
  ) {
    return '';
  }

  const notionalValue =
    inputMode === 'margin'
      ? displayValueBN.multipliedBy(leverage || 1)
      : displayValueBN;
  return formatHlSize(notionalValue.dividedBy(referencePriceBN), szDecimals);
}
