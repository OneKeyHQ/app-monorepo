import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';

import type {
  IUseOnChainRewardParams,
  IUseOnChainRewardReturn,
} from '../types';

export function useOnChainReward({
  onChain,
}: IUseOnChainRewardParams): IUseOnChainRewardReturn {
  const { activeAccount } = useActiveAccount({ num: 0 });

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

  // Use USDC token since all values are accumulated in USDC
  const { result: earnToken } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceToken.getToken({
        networkId: PERPS_NETWORK_ID,
        tokenIdOnNetwork: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        accountId: activeAccount.account?.id ?? '',
      }),
    [activeAccount.account?.id],
  );

  return {
    earnToken,
    onChainSummary,
    onChainSummaryFiat,
    hasEarnRewards,
  };
}
