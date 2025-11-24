import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import type { IUsePerpRewardParams, IUsePerpRewardReturn } from '../types';

export function usePerpReward(
  params: IUsePerpRewardParams,
): IUsePerpRewardReturn {
  const { onChain } = params;

  const hasPerpRewards = useMemo(
    () => (onChain.perp?.length || 0) > 0,
    [onChain.perp],
  );

  const perpSummary = useMemo(() => {
    if (!hasPerpRewards) return undefined;
    return onChain.perp
      ?.reduce((acc, curr) => acc.plus(BigNumber(curr.usdValue)), BigNumber(0))
      .toFixed(2);
  }, [hasPerpRewards, onChain.perp]);

  const perpSummaryFiat = useMemo(() => {
    if (!hasPerpRewards) return undefined;
    return onChain.perp
      ?.reduce((acc, curr) => acc.plus(BigNumber(curr.fiatValue)), BigNumber(0))
      .toFixed(2);
  }, [hasPerpRewards, onChain.perp]);

  const perpToken = useMemo(() => {
    return onChain.perp?.[0]?.token;
  }, [onChain.perp]);

  return {
    perpToken,
    perpSummary,
    perpSummaryFiat,
    hasPerpRewards,
  };
}
