import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type {
  IEarnTokenInfo,
  IProtocolInfo,
  IStakingInfo,
} from '@onekeyhq/shared/types/staking';
import { EClaimType } from '@onekeyhq/shared/types/staking';

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
      claimType,
      protocolInfo,
      tokenInfo,
      symbol,
      claimAmount,
      claimTokenAddress,
      isReward,
      stakingInfo,
      onSuccess,
    }: {
      claimType: EClaimType;
      protocolInfo?: IProtocolInfo;
      tokenInfo?: IEarnTokenInfo;
      symbol: string;
      claimAmount: string;
      claimTokenAddress?: string;
      isReward?: boolean;
      isMorphoClaim?: boolean;
      stakingInfo?: IStakingInfo;
      onSuccess?: () => void;
    }) => {
      if (!accountId) return;
      const provider = protocolInfo?.provider || '';
      const vault =
        protocolInfo?.approve?.approveTarget || protocolInfo?.vault || '';
      const stakingConfig =
        await backgroundApiProxy.serviceStaking.getStakingConfigs({
          networkId,
          symbol,
          provider,
        });
      if (!stakingConfig) {
        throw new OneKeyLocalError('Staking config not found');
      }
      if (isReward) {
        await handleUniversalClaim({
          amount: claimAmount,
          symbol,
          provider,
          stakingInfo,
          claimTokenAddress,
          vault,
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
          protocolInfo,
          tokenInfo,
          onSuccess,
          amount: stakingConfig.claimWithAmount ? claimAmount : undefined,
        });
        return;
      }

      if (claimType === EClaimType.ClaimOrder) {
        appNavigation.push(EModalStakingRoutes.ClaimOptions, {
          accountId,
          networkId,
          protocolInfo,
          tokenInfo,
          symbol,
          provider,
        });
        return;
      }
      if (
        claimType === EClaimType.Claim &&
        claimAmount &&
        Number(claimAmount) > 0
      ) {
        await handleUniversalClaim({
          amount: claimAmount,
          symbol,
          provider,
          claimTokenAddress,
          stakingInfo,
          protocolVault: vault,
          vault,
        });
        return;
      }

      if (stakingConfig.claimWithTx) {
        appNavigation.push(EModalStakingRoutes.ClaimOptions, {
          accountId,
          networkId,
          protocolInfo,
          tokenInfo,
          symbol,
          provider,
        });
        return;
      }
      await handleUniversalClaim({
        amount: claimAmount,
        symbol,
        provider,
        claimTokenAddress,
        stakingInfo,
        protocolVault: vault,
        vault,
      });
    },
    [accountId, networkId, handleUniversalClaim, appNavigation],
  );
};
