import BigNumber from 'bignumber.js';

import { countLeadingZeroDecimals } from '@onekeyhq/shared/src/utils/numberUtils';

export const SWAP_PRO_SLIDER_MAX_PERCENT = 100;

// Mid-drag amounts mirror the balance row's display precision, which follows
// the shared `balance` formatter: 4 decimals for values >= 1, and 4 more
// digits after the leading zero decimals for sub-1 balances (so a 0.000258
// balance keeps its resolution instead of collapsing to a 4-decimal step).
// Unlike `calcPercentBalance`, precision is anchored to the BALANCE's leading
// zeros (not the computed amount's) so every drag step lands on the same grid.
export function getSwapProSliderDragDecimals(
  availableBalance: BigNumber,
): number {
  return 4 + countLeadingZeroDecimals(availableBalance);
}

export function calcSwapProSliderAvailableBalance({
  balanceParsed,
  isNative,
  reserveGas,
}: {
  balanceParsed?: string;
  isNative?: boolean;
  reserveGas?: string | number;
}): BigNumber {
  const balanceBN = new BigNumber(balanceParsed ?? '0');
  if (balanceBN.isNaN() || balanceBN.lte(0)) {
    return new BigNumber(0);
  }
  if (isNative) {
    const reserveGasBN = new BigNumber(reserveGas ?? '');
    if (reserveGasBN.isFinite() && reserveGasBN.gt(0)) {
      return BigNumber.max(0, balanceBN.minus(reserveGasBN));
    }
  }
  return balanceBN;
}

export function calcSwapProSliderPercent({
  amount,
  availableBalance,
}: {
  amount: string;
  availableBalance: BigNumber;
}): number {
  if (availableBalance.lte(0)) {
    return 0;
  }
  const amountBN = new BigNumber(amount || '0');
  if (amountBN.isNaN() || amountBN.lte(0)) {
    return 0;
  }
  const percent = amountBN
    .dividedBy(availableBalance)
    .multipliedBy(SWAP_PRO_SLIDER_MAX_PERCENT)
    .integerValue(BigNumber.ROUND_HALF_UP)
    .toNumber();
  return Math.min(Math.max(percent, 0), SWAP_PRO_SLIDER_MAX_PERCENT);
}

export function calcSwapProSliderAmount({
  percent,
  availableBalance,
  decimals,
}: {
  percent: number;
  availableBalance: BigNumber;
  decimals?: number;
}): string | undefined {
  if (percent <= 0) {
    return undefined;
  }
  if (availableBalance.lte(0)) {
    return '0';
  }
  const tokenDecimals = Number(decimals ?? 6);
  // 100% fills the entire available balance at full token precision (the
  // balance passed in already excludes the native-token gas reserve).
  if (percent >= SWAP_PRO_SLIDER_MAX_PERCENT) {
    const fullBN = availableBalance.decimalPlaces(
      tokenDecimals,
      BigNumber.ROUND_DOWN,
    );
    if (fullBN.isNaN() || fullBN.lte(0)) {
      return undefined;
    }
    return fullBN.toFixed();
  }
  const amountBN = availableBalance
    .multipliedBy(percent)
    .dividedBy(SWAP_PRO_SLIDER_MAX_PERCENT);
  if (amountBN.isNaN() || amountBN.lt(0)) {
    return undefined;
  }
  const displayBN = amountBN.decimalPlaces(
    Math.min(getSwapProSliderDragDecimals(availableBalance), tokenDecimals),
    BigNumber.ROUND_DOWN,
  );
  if (displayBN.gt(0)) {
    return displayBN.toFixed();
  }
  // Tiny balances would collapse to zero at display precision; keep the full
  // token precision so a drag still produces a usable amount.
  const preciseBN = amountBN.decimalPlaces(tokenDecimals, BigNumber.ROUND_DOWN);
  if (preciseBN.isNaN() || preciseBN.lte(0)) {
    return undefined;
  }
  return preciseBN.toFixed();
}
