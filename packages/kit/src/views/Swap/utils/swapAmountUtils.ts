import BigNumber from 'bignumber.js';

import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  ISwapLimitPriceInfo,
  ISwapTokenBase,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapQuoteKind } from '@onekeyhq/shared/types/swap/types';

const RateBigNumber = BigNumber.clone({ DECIMAL_PLACES: 60 });

type ISwapAmountToken = Pick<
  ISwapTokenBase,
  'networkId' | 'contractAddress' | 'decimals' | 'balanceMultiplier'
>;

export type ISwapMaxAmountSnapshot = ISwapAmountToken & {
  rawAmount: string;
  displayAmount: string;
  accountId: string;
  accountAddress: string;
};

export function buildSwapMaxAmountSnapshot({
  rawAmount,
  token,
  accountId,
  accountAddress,
}: {
  rawAmount: string;
  token: ISwapAmountToken | undefined;
  accountId: string | undefined;
  accountAddress: string | undefined;
}): ISwapMaxAmountSnapshot | undefined {
  if (!token || !accountId || !accountAddress) return undefined;
  const displayAmount = getSwapDisplayAmount(
    rawAmount,
    token.balanceMultiplier,
  );
  if (!displayAmount) return undefined;
  return {
    rawAmount,
    displayAmount,
    accountId,
    accountAddress,
    networkId: token.networkId,
    contractAddress: token.contractAddress,
    decimals: token.decimals,
    balanceMultiplier: token.balanceMultiplier,
  };
}

export function isSwapMaxAmountCurrent({
  snapshot,
  displayAmount,
  token,
  accountId,
  accountAddress,
}: {
  snapshot: ISwapMaxAmountSnapshot;
  displayAmount: string;
  token: ISwapAmountToken | undefined;
  accountId: string | undefined;
  accountAddress: string | undefined;
}): boolean {
  return (
    snapshot.displayAmount === displayAmount &&
    snapshot.accountId === accountId &&
    snapshot.accountAddress === accountAddress &&
    snapshot.decimals === token?.decimals &&
    equalTokenNoCaseSensitive({ token1: snapshot, token2: token }) &&
    tokenRebaseUtils.equalBalanceMultipliers(
      snapshot.balanceMultiplier,
      token?.balanceMultiplier,
    )
  );
}

export function isSwapReviewMultiplierCurrent(
  reviewToken: { balanceMultiplier?: string } | undefined,
  selectedToken: { balanceMultiplier?: string } | undefined,
): boolean {
  return Boolean(
    reviewToken &&
    selectedToken &&
    tokenRebaseUtils.equalBalanceMultipliers(
      reviewToken.balanceMultiplier,
      selectedToken.balanceMultiplier,
    ),
  );
}

export function isSwapQuoteMultiplierCompatible(
  value: unknown,
  requested: string | undefined,
): boolean {
  return (
    value === undefined ||
    (typeof value === 'string' &&
      tokenRebaseUtils.equalBalanceMultipliers(value, requested))
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
  const amount = new BigNumber(rawAmount);
  if (
    (balanceMultiplier !== undefined &&
      !tokenRebaseUtils.isValidBalanceMultiplier(balanceMultiplier)) ||
    !amount.isFinite() ||
    amount.isNegative()
  ) {
    return undefined;
  }
  return tokenRebaseUtils.applyBalanceMultiplier({
    amount: amount.toFixed(),
    balanceMultiplier,
  });
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

export function getSwapMinimumDisplayAmount(token: {
  decimals: number;
  balanceMultiplier?: string;
}): string | undefined {
  return getSwapDisplayAmount(
    new BigNumber(1).shiftedBy(-token.decimals).toFixed(),
    token.balanceMultiplier,
  );
}

export function getSwapRawInputAmount(
  amount: string,
  token: { balanceMultiplier?: string; decimals: number },
  rounding: 'down' | 'up',
): string | undefined {
  if (token.balanceMultiplier === undefined) return amount;
  if (!tokenRebaseUtils.isValidBalanceMultiplier(token.balanceMultiplier))
    return undefined;
  if (
    !amount ||
    !tokenRebaseUtils.isScalingBalanceMultiplier(token.balanceMultiplier)
  )
    return amount;
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

export function hasScaledSwapLimitPair(
  fromToken: ISwapAmountToken | undefined,
  toToken: ISwapAmountToken | undefined,
) {
  return (
    tokenRebaseUtils.isScalingBalanceMultiplier(fromToken?.balanceMultiplier) ||
    tokenRebaseUtils.isScalingBalanceMultiplier(toToken?.balanceMultiplier)
  );
}

type ISwapLimitPriceRatio = {
  from: string;
  to: string;
};

export type ISwapLimitPriceInput = ISwapLimitPriceInfo & {
  priceRatio?: ISwapLimitPriceRatio;
};

export function getScaledSwapLimitPrice(
  price: ISwapLimitPriceInput,
  fromToken: ISwapAmountToken | undefined,
  toToken: ISwapAmountToken | undefined,
) {
  if (
    !hasScaledSwapLimitPair(fromToken, toToken) ||
    !equalTokenNoCaseSensitive({
      token1: fromToken,
      token2: price.fromToken,
    }) ||
    !equalTokenNoCaseSensitive({ token1: toToken, token2: price.toToken })
  ) {
    return undefined;
  }
  const from = new BigNumber(price.priceRatio?.from ?? '1');
  const to = new BigNumber(price.priceRatio?.to ?? price.rate ?? '');
  return from.isFinite() && from.gt(0) && to.isFinite() && to.gt(0)
    ? { from: from.toFixed(), to: to.toFixed() }
    : undefined;
}

export function getSwapLimitPriceKey(price: ISwapLimitPriceRatio | undefined) {
  return price ? `${price.from}:${price.to}` : undefined;
}

export type ISwapLimitRawAmounts = {
  fromTokenAmount: string;
  toTokenAmount: string;
};

export function getScaledSwapLimitAmounts({
  fromToken,
  toToken,
  kind,
  input,
  price,
  maxRawAmount,
}: {
  fromToken: ISwapAmountToken;
  toToken: ISwapAmountToken;
  kind: ESwapQuoteKind;
  input: string;
  price: ISwapLimitPriceRatio;
  maxRawAmount?: string;
}): ISwapLimitRawAmounts | undefined {
  const fromMultiplier = getMultiplier(fromToken.balanceMultiplier);
  const toMultiplier = getMultiplier(toToken.balanceMultiplier);
  if (!fromMultiplier || !toMultiplier) return undefined;

  if (kind === ESwapQuoteKind.BUY) {
    const toTokenAmount = getSwapRawAmount(
      input,
      toMultiplier.toFixed(),
      toToken.decimals,
      'up',
    );
    if (toTokenAmount === undefined) return undefined;
    const fromTokenAmount = getSwapRawAmount(
      new BigNumber(toTokenAmount)
        .times(toMultiplier)
        .times(price.from)
        .toFixed(),
      fromMultiplier.times(price.to).toFixed(),
      fromToken.decimals,
      'down',
    );
    if (fromTokenAmount === undefined) return undefined;
    return { fromTokenAmount, toTokenAmount };
  }

  const fromTokenAmount =
    maxRawAmount ??
    getSwapRawAmount(
      input,
      fromMultiplier.toFixed(),
      fromToken.decimals,
      'down',
    );
  if (fromTokenAmount === undefined) return undefined;
  const toTokenAmount = getSwapRawAmount(
    new BigNumber(fromTokenAmount)
      .times(fromMultiplier)
      .times(price.to)
      .toFixed(),
    toMultiplier.times(price.from).toFixed(),
    toToken.decimals,
    'up',
  );
  if (toTokenAmount === undefined) return undefined;
  return { fromTokenAmount, toTokenAmount };
}

export function getSwapLimitRateFromRawAmounts(amounts: ISwapLimitRawAmounts) {
  return new RateBigNumber(amounts.toTokenAmount)
    .dividedBy(amounts.fromTokenAmount)
    .toFixed();
}

export function getScaledSwapLimitOrderBaseUnits({
  amounts,
  fromToken,
  toToken,
  kind,
  quotedSellAmount,
  quotedBuyAmount,
}: {
  amounts: ISwapLimitRawAmounts;
  fromToken: ISwapAmountToken;
  toToken: ISwapAmountToken;
  kind?: ESwapQuoteKind;
  quotedSellAmount: string;
  quotedBuyAmount: string;
}) {
  const sellAmount = getSwapLimitOrderBaseUnits({
    rawFallback: amounts.fromTokenAmount,
    token: fromToken,
    rounding: 'down',
  });
  const buyAmount = getSwapLimitOrderBaseUnits({
    rawFallback: amounts.toTokenAmount,
    token: toToken,
    rounding: 'up',
  });
  const matchesFixedSide =
    kind === ESwapQuoteKind.SELL
      ? new BigNumber(quotedSellAmount).eq(sellAmount ?? '')
      : kind === ESwapQuoteKind.BUY &&
        new BigNumber(quotedBuyAmount).eq(buyAmount ?? '');
  return matchesFixedSide && sellAmount && buyAmount
    ? { sellAmount, buyAmount }
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
