import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EStakingActionType } from '@onekeyhq/shared/types/staking';
import type {
  IEarnTokenInfo,
  IProtocolInfo,
} from '@onekeyhq/shared/types/staking';

export const useHandleWithdraw = () => {
  const appNavigation = useAppNavigation();
  return useCallback(
    async ({
      withdrawType,
      tokenInfo,
      protocolInfo,
      accountId,
      networkId,
      symbol,
      provider,
      onSuccess,
    }: {
      withdrawType: EStakingActionType;
      protocolInfo?: IProtocolInfo;
      tokenInfo?: IEarnTokenInfo;
      accountId?: string;
      networkId: string;
      symbol: string;
      provider: string;
      onSuccess?: () => void;
    }) => {
      if (!accountId) return;
      const stakingConfig =
        await backgroundApiProxy.serviceStaking.getStakingConfigs({
          networkId,
          symbol,
          provider,
        });
      if (!stakingConfig) {
        throw new OneKeyLocalError('Staking config not found');
      }
      if (
        withdrawType === EStakingActionType.WithdrawOrder ||
        stakingConfig.withdrawWithTx
      ) {
        appNavigation.push(EModalStakingRoutes.WithdrawOptions, {
          accountId,
          networkId,
          protocolInfo,
          tokenInfo,
          symbol,
          provider,
          onSuccess,
        });
        return;
      }
      appNavigation.push(EModalStakingRoutes.Withdraw, {
        accountId,
        networkId,
        protocolInfo,
        tokenInfo,
        onSuccess,
      });
    },
    [appNavigation],
  );
};

export const useHandleStake = () => {
  const appNavigation = useAppNavigation();
  return useCallback(
    async ({
      accountId,
      networkId,
      setStakeLoading,
      onSuccess,
      indexedAccountId,
      tokenInfo,
      protocolInfo,
    }: {
      protocolInfo?: IProtocolInfo;
      tokenInfo?: IEarnTokenInfo;
      accountId?: string;
      networkId: string;
      indexedAccountId?: string;
      setStakeLoading?: (value: boolean) => void;
      onSuccess?: () => void;
    }) => {
      if (!accountId) return;

      const walletId = accountUtils.getWalletIdFromAccountId({
        accountId,
      });

      if (
        await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
          walletId,
        })
      ) {
        return;
      }

      const approveSpenderAddress = earnUtils.resolveEarnApproveSpenderAddress({
        providerName: protocolInfo?.provider || '',
        protocolVault: protocolInfo?.vault,
        backendApproveTarget: protocolInfo?.approve?.approveTarget,
      });
      const effectiveApproveType = earnUtils.resolveEarnApproveType({
        providerName: protocolInfo?.provider || '',
        networkId,
        tokenIsNative: tokenInfo?.token?.isNative,
        approveSpenderAddress,
        backendApproveType: protocolInfo?.approve?.approveType,
      });

      if (effectiveApproveType && approveSpenderAddress && tokenInfo?.token) {
        setStakeLoading?.(true);
        try {
          // Determine the correct spender address for allowance check
          const { allowanceParsed } =
            await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
              accountId,
              networkId,
              spenderAddress: earnUtils.resolveEarnAllowanceSpenderAddress({
                approveType: effectiveApproveType,
                approveSpenderAddress,
              }),
              tokenAddress: tokenInfo?.token.address || '',
            });
          appNavigation.push(EModalStakingRoutes.Stake, {
            accountId,
            networkId,
            protocolInfo,
            tokenInfo,
            currentAllowance: allowanceParsed,
          });
        } finally {
          setStakeLoading?.(false);
        }
        return;
      }
      appNavigation.push(EModalStakingRoutes.Stake, {
        accountId,
        networkId,
        indexedAccountId,
        protocolInfo,
        tokenInfo,
        onSuccess,
      });
    },
    [appNavigation],
  );
};
