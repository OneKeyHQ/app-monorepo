import BigNumber from 'bignumber.js';

import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';

const RateBigNumber = BigNumber.clone({ DECIMAL_PLACES: 60 });

export function isSwapReviewMultiplierCurrent(
  reviewToken: { balanceMultiplier?: string } | undefined,
  selectedToken: { balanceMultiplier?: string } | undefined,
): boolean {
  return Boolean(
    reviewToken &&
    selectedToken &&
    reviewToken.balanceMultiplier === selectedToken.balanceMultiplier,
  );
}

function getMultiplier(value: string | undefined): BigNumber | undefined {
  if (value === undefined) return new BigNumber(1);
  return tokenRebaseUtils.isValidBalanceMultiplier(value)
    ? new BigNumber(value)
    : undefined;
}

export function getSwapDisplayDecimals(
  decimals: number | undefined,
  balanceMultiplier: string | undefined,
): number | undefined {
  if (decimals === undefined || balanceMultiplier === undefined)
    return decimals;
  const multiplier = getMultiplier(balanceMultiplier);
  return multiplier ? decimals + (multiplier.decimalPlaces() ?? 0) : decimals;
}

export function getSwapDisplayAmount(
  rawAmount: string,
  balanceMultiplier: string | undefined,
): string | undefined {
  const multiplier = getMultiplier(balanceMultiplier);
  const amount = new BigNumber(rawAmount);
  if (!multiplier || !amount.isFinite() || amount.isNegative())
    return undefined;
  return amount.multipliedBy(multiplier).toFixed();
}

export function getSwapRawAmount(
  displayAmount: string,
  balanceMultiplier: string | undefined,
  decimals: number,
  rounding: 'down' | 'up',
): string | undefined {
  const multiplier = getMultiplier(balanceMultiplier);
  const amount = new BigNumber(displayAmount);
  if (
    !multiplier ||
    !amount.isFinite() ||
    amount.isNegative() ||
    !Number.isInteger(decimals) ||
    decimals < 0
  ) {
    return undefined;
  }
  // Divide in base units to choose the rounding direction without relying on
  // the global BigNumber decimal precision for an intermediate quotient.
  const numerator = amount.shiftedBy(decimals);
  let units = numerator.dividedToIntegerBy(multiplier);
  if (rounding === 'up' && units.multipliedBy(multiplier).lt(numerator)) {
    units = units.plus(1);
  }
  return units.shiftedBy(-decimals).toFixed();
}

export function getSwapRawInputAmount(
  amount: string,
  token: { balanceMultiplier?: string; decimals: number },
  rounding: 'down' | 'up',
): string | undefined {
  if (token.balanceMultiplier === undefined) return amount;
  if (!tokenRebaseUtils.isValidBalanceMultiplier(token.balanceMultiplier))
    return undefined;
  if (!amount) return amount;
  return getSwapRawAmount(
    amount,
    token.balanceMultiplier,
    token.decimals,
    rounding,
  );
}

export function getSwapLimitOrderBaseUnits({
  displayAmount,
  rawFallback,
  token,
  rounding,
}: {
  displayAmount?: string;
  rawFallback?: string;
  token: { balanceMultiplier?: string; decimals: number };
  rounding: 'down' | 'up';
}): string | undefined {
  const rawAmount = displayAmount
    ? getSwapRawInputAmount(displayAmount, token, rounding)
    : rawFallback;
  if (!rawAmount) return undefined;
  const units = new BigNumber(rawAmount).shiftedBy(token.decimals);
  return units.isFinite() && units.isInteger() && units.gt(0)
    ? units.toFixed()
    : undefined;
}

export function getSwapDisplayRate(
  rawRate: string,
  fromMultiplier: string | undefined,
  toMultiplier: string | undefined,
): string | undefined {
  const from = getMultiplier(fromMultiplier);
  const to = getMultiplier(toMultiplier);
  const rate = new BigNumber(rawRate);
  if (!from || !to || !rate.isFinite() || rate.isNegative()) return undefined;
  return new RateBigNumber(rate.toFixed())
    .multipliedBy(to.toFixed())
    .dividedBy(from.toFixed())
    .toFixed();
}
