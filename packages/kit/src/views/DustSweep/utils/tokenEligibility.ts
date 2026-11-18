import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import type { IDustSweepThreshold } from '@onekeyhq/shared/types/swap/dustSweep';
import { ETokenRiskLevel } from '@onekeyhq/shared/types/swap/types';
import type { IToken } from '@onekeyhq/shared/types/token';

// Token rules Dust sweep and the Home banner's count share. Kept free of the
// Dust sweep page's imports so Home can load it.

// Amount presets of the threshold picker, smallest first.
export const DUST_SWEEP_THRESHOLDS: readonly IDustSweepThreshold[] = [
  1, 10, 100,
];
// A network is listed only when something there is under the largest preset.
export const DUST_SWEEP_MAX_THRESHOLD = Math.max(...DUST_SWEEP_THRESHOLDS);

export function getDustSweepHiddenThreshold(networkId: string) {
  return networkId === 'evm--1' ? '0.1' : '0.01';
}

// Contract tokens Dust sweep can swap: not native coins, DeFi positions,
// rebasing shares or spam.
export function isDustSweepEligibleToken(
  token: Pick<
    IToken,
    | 'isNative'
    | 'defiMarked'
    | 'dappName'
    | 'sharedBalanceExcluded'
    | 'address'
    | 'riskLevel'
  >,
  balanceMultiplier: IToken['balanceMultiplier'],
) {
  return !(
    token.isNative ||
    token.defiMarked ||
    token.dappName ||
    token.sharedBalanceExcluded ||
    tokenRebaseUtils.isScalingBalanceMultiplier(balanceMultiplier) ||
    !token.address ||
    (token.riskLevel ?? 0) >= ETokenRiskLevel.SPAM
  );
}
