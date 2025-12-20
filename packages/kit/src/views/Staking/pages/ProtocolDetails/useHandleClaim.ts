import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
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
      portfolioSymbol,
      portfolioRewardSymbol,
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
      portfolioSymbol?: string;
      portfolioRewardSymbol?: string;
    }) => {
      if (!accountId) return;
      const provider = protocolInfo?.provider || '';
      const vault = protocolInfo?.vault || '';
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
          portfolioSymbol:
            portfolioSymbol || tokenInfo?.token?.symbol || undefined,
          portfolioRewardSymbol,
          vault,
        });
        return;
      }
      if (
        earnUtils.isEverstakeProvider({ providerName: provider }) &&
        symbol.toLowerCase() === 'apt'
      ) {
        appNavigation.pushModal(EModalRoutes.StakingModal, {
          screen: EModalStakingRoutes.Claim,
          params: {
            accountId,
            networkId,
            protocolInfo,
            tokenInfo,
            onSuccess,
            amount: stakingConfig.claimWithAmount ? claimAmount : undefined,
          },
        });
        return;
      }

      if (claimType === EClaimType.ClaimOrder) {
        appNavigation.pushModal(EModalRoutes.StakingModal, {
          screen: EModalStakingRoutes.ClaimOptions,
          params: {
            accountId,
            networkId,
            protocolInfo,
            tokenInfo,
            symbol,
            provider,
            onSuccess,
          },
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
          portfolioSymbol:
            portfolioSymbol || tokenInfo?.token?.symbol || undefined,
          portfolioRewardSymbol,
        });
        return;
      }

      if (stakingConfig.claimWithTx) {
        appNavigation.pushModal(EModalRoutes.StakingModal, {
          screen: EModalStakingRoutes.ClaimOptions,
          params: {
            accountId,
            networkId,
            protocolInfo,
            tokenInfo,
            symbol,
            provider,
            onSuccess,
          },
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
        portfolioSymbol:
          portfolioSymbol || tokenInfo?.token?.symbol || undefined,
        portfolioRewardSymbol,
      });
    },
    [accountId, networkId, handleUniversalClaim, appNavigation],
  );
};
