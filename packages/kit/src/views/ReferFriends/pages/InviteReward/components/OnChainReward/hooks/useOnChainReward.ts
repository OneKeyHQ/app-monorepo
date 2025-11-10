import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useNavigateToEarnReward } from '@onekeyhq/kit/src/views/ReferFriends/pages/EarnReward/hooks/useNavigateToEarnReward';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';

import type {
  IUseOnChainRewardParams,
  IUseOnChainRewardReturn,
} from '../types';

export function useOnChainReward({
  onChain,
}: IUseOnChainRewardParams): IUseOnChainRewardReturn {
  const navigateToEarnReward = useNavigateToEarnReward();
  const { activeAccount } = useActiveAccount({ num: 0 });

  // Navigation callback
  const toEarnRewardPage = useCallback(() => {
    navigateToEarnReward(onChain.title || '');
  }, [navigateToEarnReward, onChain.title]);

  // Check if rewards are available
  const showRewards = useMemo(
    () => (onChain.available?.length || 0) > 0,
    [onChain.available],
  );

  // Calculate total USD value
  const onChainSummary = useMemo(() => {
    return onChain.available
      ?.reduce((acc, curr) => {
        return acc.plus(BigNumber(curr.usdValue));
      }, BigNumber(0))
      .toFixed(2);
  }, [onChain.available]);

  // Calculate total fiat value
  const onChainSummaryFiat = useMemo(() => {
    return onChain.available
      ?.reduce((acc, curr) => {
        return acc.plus(BigNumber(curr.fiatValue));
      }, BigNumber(0))
      .toFixed(2);
  }, [onChain.available]);

  // Fetch USDC token information
  const { result: earnToken } = usePromiseResult(async () => {
    return backgroundApiProxy.serviceToken.getToken({
      networkId: PERPS_NETWORK_ID,
      tokenIdOnNetwork: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      accountId: activeAccount.account?.id ?? '',
    });
  }, [activeAccount.account?.id]);

  return {
    earnToken,
    onChainSummary,
    onChainSummaryFiat,
    showRewards,
    toEarnRewardPage,
  };
}
