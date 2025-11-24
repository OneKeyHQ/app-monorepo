import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import type {
  IUseOnChainRewardParams,
  IUseOnChainRewardReturn,
} from '../types';

export function useOnChainReward({
  onChain,
}: IUseOnChainRewardParams): IUseOnChainRewardReturn {
  const hasEarnRewards = useMemo(
    () => (onChain.available?.length || 0) > 0,
    [onChain.available],
  );

  // Calculate total USD/fiat value for a reward list
  const calculateSummary = useCallback(
    (
      rewards:
        | {
            usdValue: string;
            fiatValue: string;
          }[]
        | undefined,
      key: 'usdValue' | 'fiatValue',
    ) => {
      if (!rewards?.length) return undefined;
      return rewards
        .reduce((acc, curr) => {
          return acc.plus(BigNumber(curr[key]));
        }, BigNumber(0))
        .toFixed(2);
    },
    [],
  );

  const onChainSummary = useMemo(
    () => calculateSummary(onChain.available, 'usdValue'),
    [calculateSummary, onChain.available],
  );

  const onChainSummaryFiat = useMemo(
    () => calculateSummary(onChain.available, 'fiatValue'),
    [calculateSummary, onChain.available],
  );

  const earnToken = useMemo(() => {
    return onChain.available?.[0]?.token;
  }, [onChain.available]);

  return {
    earnToken,
    onChainSummary,
    onChainSummaryFiat,
    hasEarnRewards,
  };
}
