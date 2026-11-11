import { useCallback, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { getEarnProtocol } from '@onekeyhq/kit/src/views/Earn/protocols';
import {
  getTaskAccountAddress,
  isTaskAccountAddress,
  isTaskAccountCurrent,
  isTaskEncodedTxOwner,
} from '@onekeyhq/kit/src/views/Earn/tasks/taskAccount';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EModalRoutes,
  EModalSignatureConfirmRoutes,
  EModalStakingRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
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

import {
  createEarnConfirmationLifecycle,
  createEarnConfirmationTaskAdapter,
} from '../../../Earn/tasks/confirmationTaskAdapter';
import { createLateEarnOrderObserver } from '../../../Earn/tasks/lateEarnOrderRecorder';
import { createEarnSingleTransactionTaskState } from '../../../Earn/tasks/singleTransactionTaskState';
import { createEarnTransactionTaskController } from '../../../Earn/tasks/transactionTaskController';
import { useCommittedEarnScopeGuard } from '../../hooks/useCommittedEarnScopeGuard';

import type { IEarnSingleTransactionStep } from '../../../Earn/tasks/singleTransactionTaskState';

export const useHandleWithdraw = (scopeKey = '') => {
  const appNavigation = useAppNavigation();
  const scope = useCommittedEarnScopeGuard(scopeKey);
  const resultAttemptRef = useRef(0);
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
      const isCurrent = scope.capture();
      if (!isCurrent()) return;
      resultAttemptRef.current += 1;
      const resultAttempt = resultAttemptRef.current;
      const isResultCurrent = () =>
        isCurrent() && resultAttemptRef.current === resultAttempt;
      const stakingConfig =
        await backgroundApiProxy.serviceStaking.getStakingConfigs({
          networkId,
          symbol,
          provider,
        });
      if (!stakingConfig) {
        throw new OneKeyLocalError('Staking config not found');
      }
      if (!isCurrent()) return;
      if (withdrawType === EStakingActionType.CancelWithdrawal) {
        const taskAccountAddress =
          protocolInfo?.earnAccount?.accountId === accountId &&
          protocolInfo.earnAccount.networkId === networkId
            ? protocolInfo.earnAccount.accountAddress
            : undefined;
        const resolvedAccountAddress = await getTaskAccountAddress({
          accountId,
          networkId,
        });
        if (!isCurrent()) return;
        if (
          taskAccountAddress &&
          !isTaskAccountAddress(
            { accountAddress: taskAccountAddress, networkId },
            resolvedAccountAddress,
          )
        ) {
          throw new OneKeyLocalError('Withdrawal account changed');
        }
        const taskIdentity = {
          accountId,
          networkId,
          accountAddress: resolvedAccountAddress,
          provider,
          action: 'cancelWithdrawal',
          intent: { symbol, protocolVault: protocolInfo?.vault },
        };
        type ICancelStep = IEarnSingleTransactionStep<'protocol'>;
        type IUnsignedTx = Awaited<
          ReturnType<
            typeof backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx
          >
        >;
        type IPreparedCancel = {
          unsignedTx: IUnsignedTx;
          stakingInfo: IStakingInfo;
        };
        const state = createEarnSingleTransactionTaskState({
          taskId: generateUUID(),
          identity: taskIdentity,
          step: { id: 'cancelWithdrawal', kind: 'protocol' as const },
          lateSubmitted: 'confirming',
        });
        const observeLateOrder = createLateEarnOrderObserver({
          accountId,
          networkId,
          onError: () => {
            console.error('Unable to record late Earn order');
          },
        });
        const confirmationLifetime = createEarnConfirmationLifecycle();
        const confirmation = createEarnConfirmationTaskAdapter<
          typeof taskIdentity,
          ICancelStep,
          IPreparedCancel,
          ISendTxOnSuccessData[],
          Error
        >({
          prepare: async () => {
            const unstakeTx =
              await backgroundApiProxy.serviceStaking.buildUnstakeTransaction({
                accountId,
                networkId,
                ...(resolvedAccountAddress
                  ? { expectedAccountAddress: resolvedAccountAddress }
                  : undefined),
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
            if (
              resolvedAccountAddress &&
              ((typeof encodedTx === 'object' &&
                encodedTx !== null &&
                'from' in encodedTx &&
                !isTaskEncodedTxOwner(
                  { accountAddress: resolvedAccountAddress, networkId },
                  encodedTx,
                )) ||
                !(await isTaskAccountCurrent({
                  accountId,
                  networkId,
                  accountAddress: resolvedAccountAddress,
                })))
            ) {
              throw new OneKeyLocalError('Withdrawal account changed');
            }
            if (!isCurrent())
              throw new OneKeyLocalError('Withdrawal action expired');
            const stakingInfo: IStakingInfo = {
              label: EEarnLabels.Withdraw,
              protocol: earnUtils.getEarnProviderName({
                providerName: provider,
              }),
              protocolLogoURI: protocolInfo?.providerDetail.logoURI,
              tags: protocolInfo?.stakeTag ? [protocolInfo.stakeTag] : [],
              orderId: unstakeTx.orderId,
            };
            const unsignedTx =
              await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx(
                {
                  accountId,
                  networkId,
                  encodedTx,
                  stakingInfo,
                },
              );
            return { unsignedTx, stakingInfo };
          },
          navigate: async ({ unsignedTx, stakingInfo }, callbacks) => {
            appNavigation.pushModal(EModalRoutes.SignatureConfirmModal, {
              screen: EModalSignatureConfirmRoutes.TxConfirm,
              params: {
                accountId,
                networkId,
                unsignedTxs: [unsignedTx],
                gasAccountScenario: 'earn',
                onSuccess: callbacks.onSuccess,
                onBeforeSend: () =>
                  confirmationLifetime.beforeSend(async () => {
                    if (confirmationLifetime.isClosed() || !isCurrent())
                      throw new OneKeyLocalError('Withdrawal action expired');
                    if (
                      resolvedAccountAddress &&
                      !(await isTaskAccountCurrent({
                        accountId,
                        networkId,
                        accountAddress: resolvedAccountAddress,
                      }))
                    )
                      throw new OneKeyLocalError('Withdrawal account changed');
                    if (confirmationLifetime.isClosed() || !isCurrent())
                      throw new OneKeyLocalError('Withdrawal action expired');
                    callbacks.onSendObserved();
                  }),
                onSafePreSendFail: () => undefined,
                onCancel: () => {
                  confirmationLifetime.close();
                  callbacks.onCancel();
                },
                onFail: (error) => {
                  confirmationLifetime.close();
                  callbacks.onFail(error);
                },
                onLateBroadcastAccepted: (fact) =>
                  observeLateOrder({
                    fact,
                    stakeInfo: stakingInfo,
                    onAccepted: callbacks.onLateBroadcastAccepted,
                  }),
              },
            });
          },
          onSuccess: async (data, { stakingInfo }) => {
            const orderTx = Array.isArray(data)
              ? data[data.length - 1]
              : undefined;
            if (orderTx?.signedTx?.txid && stakingInfo.orderId) {
              const order = {
                orderId: stakingInfo.orderId,
                networkId,
                txId: orderTx.signedTx.txid,
                status: orderTx.decodedTx.status,
                stakingLabel: stakingInfo.label,
                stakingProtocol: stakingInfo.protocol,
                stakingTags: stakingInfo.tags,
              };
              if (!confirmationLifetime.isClosed() && isResultCurrent()) {
                await backgroundApiProxy.serviceStaking.addEarnOrder(order);
              } else {
                await backgroundApiProxy.serviceStaking.addEarnOrder(order, {
                  remoteSync: 'once',
                  preserveExistingTx: true,
                });
              }
            }
            if (confirmationLifetime.isClosed() || !isResultCurrent()) return;
            if (resolvedAccountAddress) {
              try {
                if (
                  !(await isTaskAccountCurrent({
                    accountId,
                    networkId,
                    accountAddress: resolvedAccountAddress,
                  }))
                )
                  return;
              } catch {
                return;
              }
            }
            if (!confirmationLifetime.isClosed() && isResultCurrent())
              onSuccess?.();
          },
          onObserverError: () => {
            console.error('Unable to update Earn task state');
          },
          getTxid: (data) => data[data.length - 1]?.signedTx?.txid,
          failureCertainty: () => 'unknown',
          cancellationCertainty: () => 'unknown',
        });
        const controller = createEarnTransactionTaskController({
          state,
          adapter: confirmation.adapter,
          normalizePreparation: (preparation) => preparation,
          shouldHandoffOnSubmit: () => true,
          isCurrent,
          onChange: () => undefined,
          expiredMessage: 'Withdrawal action expired',
        });
        await confirmation.start(controller.run);
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
    [appNavigation, scope],
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

      const approveSpenderAddress = getEarnProtocol(
        protocolInfo?.provider || '',
      ).resolveApproveSpenderAddress({
        protocolVault: protocolInfo?.vault,
        backendApproveTarget: protocolInfo?.approve?.approveTarget,
      });
      const effectiveApproveType = getEarnProtocol(
        protocolInfo?.provider || '',
      ).resolveApproveType({
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
              spenderAddress: getEarnProtocol(
                protocolInfo?.provider || '',
              ).resolveAllowanceSpenderAddress({
                networkId,
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
