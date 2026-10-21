import BigNumber from 'bignumber.js';

import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import type {
  IDustSweepThreshold,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';
import {
  swapSlippageWillAheadMinValue,
  swapSlippageWillFailMinValue,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { ETokenRiskLevel } from '@onekeyhq/shared/types/swap/types';
import type { IFetchAccountTokensResp } from '@onekeyhq/shared/types/token';

import { isSwapTokenRisky } from '../../Swap/utils/swapTokenRiskUtils';

// Amount presets of the threshold picker, smallest first.
export const DUST_SWEEP_THRESHOLDS: readonly IDustSweepThreshold[] = [
  1, 10, 100,
];

export function getDustSweepHiddenThreshold(networkId: string) {
  return networkId === 'evm--1' ? '0.1' : '0.01';
}

// Worth less than the gas to sweep it: hidden until the user adds them, and
// never selected by default.
export function isDustSweepBelowGasThreshold(token: IDustSweepToken) {
  return new BigNumber(token.valueUsd).lt(
    getDustSweepHiddenThreshold(token.networkId),
  );
}

export function buildDustSweepCandidates(
  response: IFetchAccountTokensResp,
  networkId: string,
) {
  const seen = new Set<string>();
  return [
    ...response.tokens.data,
    ...response.smallBalanceTokens.data,
    ...response.riskTokens.data,
  ]
    .flatMap((token): IDustSweepToken[] => {
      const key = token.$key;
      const value =
        response.tokens.map[key] ??
        response.smallBalanceTokens.map[key] ??
        response.riskTokens.map[key];
      if (
        seen.has(key) ||
        !value ||
        token.isNative ||
        token.defiMarked ||
        token.dappName ||
        token.sharedBalanceExcluded ||
        tokenRebaseUtils.isScalingBalanceMultiplier(
          value?.balanceMultiplier ?? token.balanceMultiplier,
        ) ||
        !token.address ||
        (token.networkId && token.networkId !== networkId) ||
        (token.riskLevel ?? 0) >= ETokenRiskLevel.SPAM
      )
        return [];
      seen.add(key);
      const amount = new BigNumber(
        value.balanceParsed ??
          new BigNumber(value.balance).shiftedBy(-token.decimals),
      );
      const usd = new BigNumber(value.fiatValue);
      if (!amount.isFinite() || !amount.gt(0) || !usd.isFinite() || !usd.gt(0))
        return [];
      return [
        {
          key,
          networkId,
          contractAddress: token.address,
          isNative: false,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          logoURI: token.logoURI,
          balanceParsed: amount.toFixed(),
          amount: amount.toFixed(),
          balanceMultiplier: value.balanceMultiplier ?? token.balanceMultiplier,
          price: value.price?.toString(),
          fiatValue: usd.toFixed(),
          valueUsd: usd.toFixed(),
          suspicious: isSwapTokenRisky({
            ...token,
            networkId,
            contractAddress: token.address,
            price: value.price?.toString(),
          }),
        },
      ];
    })
    .toSorted((a, b) => new BigNumber(b.valueUsd).comparedTo(a.valueUsd) ?? 0);
}

export function filterDustSweepCandidates(
  tokens: IDustSweepToken[],
  threshold: IDustSweepThreshold,
  includeHidden: boolean,
) {
  const eligible = tokens.filter((token) =>
    new BigNumber(token.valueUsd).lt(threshold),
  );
  const hidden = eligible.filter(isDustSweepBelowGasThreshold);
  const hiddenKeys = new Set(hidden.map((token) => token.key));
  const visible = eligible.filter((token) => !hiddenKeys.has(token.key));
  return {
    visible: includeHidden ? [...visible, ...hidden] : visible,
    hidden: includeHidden ? [] : hidden,
  };
}

export function isValidDustSweepSlippage(value: string) {
  const number = new BigNumber(value);
  return number.isFinite() && number.gt(0) && number.lte(50);
}

// Dust Sweep only warns above 10%; 10% itself is a normal choice here.
export function getDustSweepSlippageNotice(
  value: string,
): 'invalid' | 'tooLow' | 'tooHigh' | undefined {
  if (!isValidDustSweepSlippage(value)) return 'invalid';
  const number = new BigNumber(value);
  if (number.lte(swapSlippageWillFailMinValue)) return 'tooLow';
  if (number.gt(swapSlippageWillAheadMinValue)) return 'tooHigh';
  return undefined;
}
