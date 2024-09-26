import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type {
  IStakeProtocolDetails,
  IStakingInfo,
} from '@onekeyhq/shared/types/staking';

import { useUniversalClaim } from '../../hooks/useUniversalHooks';

export const useHandleClaim = ({
  accountId,
  networkId,
}: {
  accountId?: string;
  networkId: string;
}) => {
  const appNavigation = useAppNavigation();
  const handleUniversalClaim = useUniversalClaim({
    networkId,
    accountId: accountId ?? '',
  });
  return useCallback(
    async ({
      details,
      symbol,
      provider,
      isReward,
      stakingInfo,
      onSuccess,
    }: {
      symbol: string;
      provider: string;
      isReward?: boolean;
      details?: IStakeProtocolDetails;
      stakingInfo?: IStakingInfo;
      onSuccess?: () => void;
    }) => {
      if (!details || !accountId) return;
      const stakingConfig =
        await backgroundApiProxy.serviceStaking.getStakingConfigs({
          networkId,
          symbol,
          provider,
        });
      if (!stakingConfig) {
        throw new Error('Staking config not found');
      }
      if (isReward) {
        await handleUniversalClaim({
          amount: details.rewards ?? '0',
          symbol,
          provider,
          stakingInfo,
        });
        return;
      }
      if (stakingConfig.claimWithTx) {
        appNavigation.push(EModalStakingRoutes.ClaimOptions, {
          accountId,
          networkId,
          details,
          symbol,
          provider,
        });
        return;
      }
      if (
        provider.toLowerCase() === 'everstake' &&
        symbol.toLowerCase() === 'apt'
      ) {
        appNavigation.push(EModalStakingRoutes.Claim, {
          accountId,
          networkId,
          details,
          onSuccess,
          amount: stakingConfig.claimWithAmount ? details.claimable : undefined,
        });
        return;
      }
      await handleUniversalClaim({
        amount: details.claimable ?? '0',
        symbol,
        provider,
        stakingInfo,
      });
    },
    [appNavigation, accountId, networkId, handleUniversalClaim],
  );
};
