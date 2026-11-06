import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { getEarnProtocol } from '@onekeyhq/kit/src/views/Earn/protocols';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type {
  IEarnClaimType,
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
      claimRequestType,
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
      claimRequestType?: IEarnClaimType;
      isReward?: boolean;
      stakingInfo?: IStakingInfo;
      onSuccess?: () => void;
      portfolioSymbol?: string;
      portfolioRewardSymbol?: string;
    }) => {
      if (!accountId) return;
      const provider = protocolInfo?.provider || '';
      const earnProtocol = getEarnProtocol(provider);
      const vault = protocolInfo?.vault || '';
      const taskAccountAddress =
        protocolInfo?.earnAccount?.accountId === accountId &&
        protocolInfo.earnAccount.networkId === networkId
          ? protocolInfo.earnAccount.accountAddress
          : undefined;
      const claimTokenAddressForRequest =
        earnProtocol.usesClaimRewardTokenAddress()
          ? claimTokenAddress
          : undefined;
      const effectiveClaimRequestType =
        claimRequestType ||
        earnProtocol.resolveDefaultClaimRequestType({ claimType });
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
          taskAccountAddress,
          amount: claimAmount,
          symbol,
          provider,
          stakingInfo,
          claimTokenAddress: claimTokenAddressForRequest,
          claimType: effectiveClaimRequestType,
          portfolioSymbol:
            portfolioSymbol || tokenInfo?.token?.symbol || undefined,
          portfolioRewardSymbol,
          vault,
        });
        return;
      }
      if (earnProtocol.getClaimNavigation({ symbol }) === 'amount-modal') {
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
        (claimType === EClaimType.Claim ||
          claimType === EClaimType.ClaimAirdrop) &&
        claimAmount &&
        Number(claimAmount) > 0
      ) {
        await handleUniversalClaim({
          taskAccountAddress,
          amount: claimAmount,
          symbol,
          provider,
          claimTokenAddress: claimTokenAddressForRequest,
          claimType: effectiveClaimRequestType,
          stakingInfo,
          protocolVault: vault,
          vault,
          portfolioSymbol:
            portfolioSymbol || tokenInfo?.token?.symbol || undefined,
          portfolioRewardSymbol,
          // Every other branch hands onSuccess on; these two dropped it, so a
          // caller that passed one was never told the claim landed.
          onSuccess,
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
        taskAccountAddress,
        amount: claimAmount,
        symbol,
        provider,
        claimTokenAddress: claimTokenAddressForRequest,
        claimType: effectiveClaimRequestType,
        stakingInfo,
        protocolVault: vault,
        vault,
        portfolioSymbol:
          portfolioSymbol || tokenInfo?.token?.symbol || undefined,
        portfolioRewardSymbol,
        onSuccess,
      });
    },
    [accountId, networkId, handleUniversalClaim, appNavigation],
  );
};
