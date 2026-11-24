import BigNumber from 'bignumber.js';

import { countLeadingZeroDecimals } from '@onekeyhq/shared/src/utils/numberUtils';

import { getSwapDisplayAmount, getSwapRawAmount } from './swapAmountUtils';

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

// `dividedBy` rounds its quotient to BigNumber's global decimal places (20 by
// default) before the token precision is applied, which rounds a share of a
// few raw units up or away on tokens with that many decimals. Shifting the
// product is exact.
function calcExactShare(balance: BigNumber, percent: number): BigNumber {
  return balance.multipliedBy(percent).shiftedBy(-2);
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
  const amountBN = calcExactShare(availableBalance, percent);
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

interface ISwapProSliderDisplayAmountParams {
  percent: number;
  // Raw balance the share is taken from, before the token's balance
  // multiplier. The Pro slider passes it with the native gas reserve deducted.
  availableBalance: BigNumber;
  // Raw balance the user reads in the balance row, which sets the precision.
  // Defaults to `availableBalance`.
  precisionBalance?: BigNumber;
  decimals?: number;
  balanceMultiplier: string | undefined;
}

function toDisplayBalance(
  rawBalance: BigNumber,
  balanceMultiplier: string | undefined,
): BigNumber | undefined {
  const displayBalance = getSwapDisplayAmount(
    rawBalance.toFixed(),
    balanceMultiplier,
  );
  return displayBalance === undefined
    ? undefined
    : new BigNumber(displayBalance);
}

type ISwapShareDisplayAmount =
  | { status: 'invalid' }
  // The share is smaller than one raw unit of the token.
  | { status: 'below-unit' }
  | { status: 'amount'; displayAmount: string };

// A rebasing token shows its balance times a multiplier, so the share is
// rounded on the shown balance: rounding the raw amount and multiplying after
// brings every digit back. Rounding down keeps the raw amount it converts to
// within the share. Near the smallest unit that rounding can drop the amount
// below one raw unit while the share itself is spendable; the exact shown
// value of the raw share is filled then.
function calcShareDisplayAmount({
  percent,
  availableBalance,
  precisionBalance,
  decimals,
  balanceMultiplier,
}: ISwapProSliderDisplayAmountParams): ISwapShareDisplayAmount {
  const displayBalance = toDisplayBalance(availableBalance, balanceMultiplier);
  if (!displayBalance) {
    return { status: 'invalid' };
  }
  if (percent <= 0) {
    return { status: 'below-unit' };
  }
  if (availableBalance.lte(0)) {
    return { status: 'amount', displayAmount: '0' };
  }
  const tokenDecimals = Number(decimals ?? 6);
  const rawShare = calcExactShare(availableBalance, percent).decimalPlaces(
    tokenDecimals,
    BigNumber.ROUND_DOWN,
  );
  if (rawShare.isNaN() || rawShare.lte(0)) {
    return { status: 'below-unit' };
  }
  const shownPrecisionBalance =
    precisionBalance && precisionBalance.gt(0)
      ? toDisplayBalance(precisionBalance, balanceMultiplier)
      : undefined;
  const compactAmount = calcExactShare(displayBalance, percent).decimalPlaces(
    Math.min(
      getSwapProSliderDragDecimals(shownPrecisionBalance ?? displayBalance),
      tokenDecimals,
    ),
    BigNumber.ROUND_DOWN,
  );
  const compactRawAmount = getSwapRawAmount(
    compactAmount.toFixed(),
    balanceMultiplier,
    tokenDecimals,
    'down',
  );
  if (compactRawAmount !== undefined && new BigNumber(compactRawAmount).gt(0)) {
    return { status: 'amount', displayAmount: compactAmount.toFixed() };
  }
  const exactDisplayAmount = getSwapDisplayAmount(
    rawShare.toFixed(),
    balanceMultiplier,
  );
  return exactDisplayAmount === undefined
    ? { status: 'invalid' }
    : { status: 'amount', displayAmount: exactDisplayAmount };
}

// The amount a drag below 100% puts in the input, in the units the user reads.
// 100% is the caller's: it must fill the exact raw balance. A share below one
// raw unit returns nothing, so the drag keeps the amount already there.
export function calcSwapProSliderDisplayAmount(
  params: ISwapProSliderDisplayAmountParams,
): string | undefined {
  const share = calcShareDisplayAmount(params);
  return share.status === 'amount' ? share.displayAmount : undefined;
}

// Whether the share is too small to hold one raw unit of the token. A drag
// passes over such a position without writing; a selection that ends there
// has to be answered by the caller.
export function isSwapShareBelowUnit(
  params: ISwapProSliderDisplayAmountParams,
): boolean {
  return calcShareDisplayAmount(params).status === 'below-unit';
}

// The amount a percentage stage button fills. Unlike a drag, a tap must always
// answer: a share below the token's smallest unit fills 0, because leaving the
// previous amount in place would read as that amount being the chosen share.
export function calcSwapPercentageStageAmount(
  params: ISwapProSliderDisplayAmountParams,
): string | undefined {
  const share = calcShareDisplayAmount(params);
  if (share.status === 'invalid') {
    return undefined;
  }
  return share.status === 'amount' ? share.displayAmount : '0';
}
