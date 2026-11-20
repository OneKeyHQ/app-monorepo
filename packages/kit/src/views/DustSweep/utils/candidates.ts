import BigNumber from 'bignumber.js';

import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IDustSweepThreshold,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';
import { swapSlippageWillAheadMinValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { ETokenRiskLevel } from '@onekeyhq/shared/types/swap/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import type { IFetchAccountTokensResp } from '@onekeyhq/shared/types/token';

import { isSwapTokenRisky } from '../../Swap/utils/swapTokenRiskUtils';

// Amount presets of the threshold picker, smallest first.
export const DUST_SWEEP_THRESHOLDS: readonly IDustSweepThreshold[] = [
  1, 10, 100,
];
export const DUST_SWEEP_MIN_SLIPPAGE = 5;
export const DUST_SWEEP_MAX_SLIPPAGE = 50;

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
  swapTokens: ISwapToken[],
) {
  const seen = new Set<string>();
  const swapTokensByAddress = new Map<string, ISwapToken>();
  const excludedSwapAddresses = new Set<string>();
  swapTokens.forEach((token) => {
    const address = normalizeTokenContractAddress({
      networkId,
      contractAddress: token.contractAddress,
    });
    if (token.networkId !== networkId || token.isNative || !address) return;
    if (
      tokenRebaseUtils.isScalingBalanceMultiplier(token.balanceMultiplier) ||
      (token.riskLevel ?? 0) >= ETokenRiskLevel.SPAM
    ) {
      excludedSwapAddresses.add(address);
    }
    const previous = swapTokensByAddress.get(address);
    if (!previous || (token.riskLevel ?? 0) > (previous.riskLevel ?? 0)) {
      swapTokensByAddress.set(address, token);
    }
  });
  return [
    ...response.tokens.data,
    ...response.smallBalanceTokens.data,
    ...response.riskTokens.data,
  ]
    .flatMap((token): IDustSweepToken[] => {
      const key = token.$key;
      const address = normalizeTokenContractAddress({
        networkId,
        contractAddress: token.address,
      });
      const swapToken = address ? swapTokensByAddress.get(address) : undefined;
      const value =
        response.tokens.map[key] ??
        response.smallBalanceTokens.map[key] ??
        response.riskTokens.map[key];
      if (
        !address ||
        seen.has(address) ||
        excludedSwapAddresses.has(address) ||
        !swapToken ||
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
      const amount = new BigNumber(
        value.balanceParsed ??
          new BigNumber(value.balance).shiftedBy(-token.decimals),
      );
      const usd = new BigNumber(value.fiatValue);
      if (!amount.isFinite() || !amount.gt(0) || !usd.isFinite() || !usd.gt(0))
        return [];
      seen.add(address);
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
            riskLevel: Math.max(token.riskLevel ?? 0, swapToken.riskLevel ?? 0),
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
  return (
    number.isFinite() &&
    number.gte(DUST_SWEEP_MIN_SLIPPAGE) &&
    number.lte(DUST_SWEEP_MAX_SLIPPAGE)
  );
}

// Dust Sweep only warns above 10%; 10% itself is a normal choice here.
export function getDustSweepSlippageNotice(
  value: string,
): 'invalid' | 'tooLow' | 'tooHigh' | undefined {
  const number = new BigNumber(value);
  if (number.isFinite() && number.gte(0) && number.lt(DUST_SWEEP_MIN_SLIPPAGE))
    return 'tooLow';
  if (!isValidDustSweepSlippage(value)) return 'invalid';
  if (number.gt(swapSlippageWillAheadMinValue)) return 'tooHigh';
  return undefined;
}
