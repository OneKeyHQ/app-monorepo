import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EModalRoutes,
  EModalSignatureConfirmRoutes,
  EModalStakingRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import {
  EEarnLabels,
  EInternalDappEnum,
  EInternalStakingAction,
  EStakingActionType,
} from '@onekeyhq/shared/types/staking';
import type {
  IEarnTokenInfo,
  IProtocolInfo,
  IStakingInfo,
} from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

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
      if (withdrawType === EStakingActionType.CancelWithdrawal) {
        const unstakeTx =
          await backgroundApiProxy.serviceStaking.buildUnstakeTransaction({
            accountId,
            networkId,
            symbol,
            provider,
            amount: '0',
            protocolVault: protocolInfo?.vault,
            withdrawAll: false,
            withdrawType: 'cancel',
          });
        const encodedTx =
          await backgroundApiProxy.serviceStaking.buildInternalDappTx({
            networkId,
            accountId,
            tx: unstakeTx.tx,
            internalDappType: EInternalDappEnum.Staking,
            stakingAction: EInternalStakingAction.Withdraw,
          });
        const stakingInfo: IStakingInfo = {
          label: EEarnLabels.Withdraw,
          protocol: earnUtils.getEarnProviderName({ providerName: provider }),
          protocolLogoURI: protocolInfo?.providerDetail.logoURI,
          tags: protocolInfo?.stakeTag ? [protocolInfo.stakeTag] : [],
          orderId: unstakeTx.orderId,
        };
        const unsignedTx =
          await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
            accountId,
            networkId,
            encodedTx,
            stakingInfo,
          });
        appNavigation.pushModal(EModalRoutes.SignatureConfirmModal, {
          screen: EModalSignatureConfirmRoutes.TxConfirm,
          params: {
            accountId,
            networkId,
            unsignedTxs: [unsignedTx],
            gasAccountScenario: 'earn',
            onSuccess: async (data: ISendTxOnSuccessData[]) => {
              const orderTx = Array.isArray(data)
                ? data[data.length - 1]
                : undefined;
              if (orderTx?.signedTx?.txid && stakingInfo.orderId) {
                await backgroundApiProxy.serviceStaking.addEarnOrder({
                  orderId: stakingInfo.orderId,
                  networkId,
                  txId: orderTx.signedTx.txid,
                  status: orderTx.decodedTx.status,
                  stakingLabel: stakingInfo.label,
                  stakingProtocol: stakingInfo.protocol,
                  stakingTags: stakingInfo.tags,
                });
              }
              onSuccess?.();
            },
          },
        });
        return;
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
