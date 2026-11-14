import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import { createLateEarnOrderRecorder } from '@onekeyhq/kit/src/views/Earn/tasks/lateEarnOrderRecorder';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { type IModalSendParamList } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import {
  type EApproveType,
  EInternalDappEnum,
  EInternalStakingAction,
  type IEarnClaimType,
  type IEarnPermit2ApproveSignData,
  type IEarnStakeType,
  type IEarnWithdrawType,
  type IStakeTxResponse,
  type IStakeTxStakefishExitBroadcast,
  type IStakingInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import {
  showEarnRiskWarningDialog,
  useEarnRiskWarningGate,
} from '../components/EarnRiskWarningDialog';
import { useShowClaimEstimateGasAlert } from '../components/EstimateNetworkFee';
import { runDirectDepositTask } from '../earnDepositTask/directDepositTask';
import {
  getTaskAccountAddress,
  isTaskAccountAddress,
  isTaskAccountCurrent,
  isTaskEncodedTxOwner,
} from '../earnDepositTask/taskAccount';
import {
  buildEarnStakeConfirmation,
  createStakeInfoWithOrderId,
} from '../earnDepositTask/transactionBuilder';
import { waitForEarnTransactionConfirm } from '../earnDepositTask/transactionConfirm';
import { runWrappedStakeTask } from '../earnDepositTask/wrappedStakeTask';
import { isValidWrappedStakeToken } from '../utils/utils';

import type { IDepositTask, IDepositTaskState } from '../earnDepositTask/state';
import type {
  IDepositTaskHandle,
  IDirectDepositTaskConfig,
} from '../earnDepositTask/types';

const getEarnOrderTrackingInfo = (stakingInfo?: IStakingInfo) => ({
  stakingLabel: stakingInfo?.label,
  stakingProtocol: stakingInfo?.protocol,
  stakingTags: stakingInfo?.tags,
});

type ITxConfirmResult =
  | {
      status: 'success';
      data: ISendTxOnSuccessData[];
    }
  | {
      status: 'cancel';
    };

const recordStakeOrder = async ({
  data,
  stakeInfo,
  networkId,
  remoteSync,
  preserveExistingTx,
}: {
  data: ISendTxOnSuccessData[];
  stakeInfo?: IStakingInfo;
  networkId: string;
  remoteSync?: 'once';
  preserveExistingTx?: true;
}) => {
  const orderTx = Array.isArray(data) ? data[data.length - 1] : undefined;
  const txid =
    orderTx?.signedTx?.txid?.trim() || orderTx?.decodedTx?.txid?.trim();
  if (orderTx && txid && stakeInfo?.orderId) {
    return backgroundApiProxy.serviceStaking.addEarnOrder(
      {
        orderId: stakeInfo.orderId,
        networkId,
        txId: txid,
        status: orderTx.decodedTx.status,
        ...getEarnOrderTrackingInfo(stakeInfo),
      },
      remoteSync
        ? { remoteSync, ...(preserveExistingTx ? { preserveExistingTx } : {}) }
        : undefined,
    );
  }
};

const handleStakeSuccess = async ({
  data,
  stakeInfo,
  networkId,
  onSuccess,
}: {
  data: ISendTxOnSuccessData[];
  stakeInfo?: IStakingInfo;
  networkId: string;
  onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
}) => {
  await recordStakeOrder({ data, stakeInfo, networkId });
  onSuccess?.(data);
};

const handleTaskStakeSuccess = async ({
  data,
  stakeInfo,
  networkId,
  accountId,
  accountAddress,
  isCurrent,
  lateAfterSettlement,
  onSuccess,
}: {
  data: ISendTxOnSuccessData[];
  stakeInfo?: IStakingInfo;
  networkId: string;
  accountId: string;
  accountAddress: string;
  isCurrent: () => boolean;
  lateAfterSettlement?: boolean;
  onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
}) => {
  let result: Awaited<ReturnType<typeof recordStakeOrder>>;
  try {
    result = await recordStakeOrder({
      data,
      stakeInfo,
      networkId,
      remoteSync: 'once',
      ...(lateAfterSettlement ? { preserveExistingTx: true as const } : {}),
    });
  } catch {
    return 'remoteUnknown' as const;
  }
  if (stakeInfo?.orderId && !result) return 'remoteUnknown' as const;
  if (result?.remoteStatus === 'failed') {
    return 'remoteUnknown' as const;
  }
  if (result?.localStatus === 'existing') return 'remoteUnknown' as const;
  if (result?.localStatus === 'superseded') {
    return result.remoteStatus === 'skipped'
      ? ('superseded' as const)
      : ('remoteUnknown' as const);
  }
  if (
    result?.localStatus === 'failed' ||
    result?.localStatus === 'unavailable'
  ) {
    if (result.remoteStatus !== 'notAttempted') return 'remoteUnknown' as const;
    if (result.localStatus === 'failed')
      throw new OneKeyLocalError('Unable to store Earn order');
    return 'localUnavailable' as const;
  }
  if (
    result &&
    (result.localStatus !== 'saved' || result.remoteStatus !== 'synced')
  )
    return 'remoteUnknown' as const;
  if (!isCurrent() || lateAfterSettlement)
    return result ? undefined : ('notTracked' as const);
  try {
    if (
      !(await isTaskAccountCurrent({ accountId, networkId, accountAddress })) ||
      !isCurrent()
    ) {
      return result
        ? ('recordedAwaitingOwner' as const)
        : ('untrackedAwaitingOwner' as const);
    }
  } catch {
    return result
      ? ('recordedAwaitingOwner' as const)
      : ('untrackedAwaitingOwner' as const);
  }
  try {
    await Promise.resolve(onSuccess?.(data));
  } catch (error) {
    if (isCurrent()) errorToastUtils.showToastOfError(error);
  }
  if (!result) return 'notTracked' as const;
};

export function useUniversalStake({
  networkId,
  accountId,
  scopeKey,
}: {
  networkId: string;
  accountId: string;
  scopeKey?: string;
}) {
  const operationScope = [accountId, networkId, scopeKey].join('|');
  const [scope, setScope] = useState(() => ({ operationScope }));
  if (scope.operationScope !== operationScope) setScope({ operationScope });
  const committedScopeRef = useRef(scope);
  useLayoutEffect(() => {
    committedScopeRef.current = scope;
  }, [scope]);
  const lifetimeRef = useRef<object | undefined>(undefined);
  const wrapAbortRef = useRef<
    { scope: typeof scope; controller: AbortController } | undefined
  >(undefined);
  useEffect(
    () => () => {
      if (wrapAbortRef.current?.scope === scope) {
        wrapAbortRef.current.controller.abort();
      }
    },
    [scope],
  );
  useEffect(() => {
    const lifetime = {};
    lifetimeRef.current = lifetime;
    return () => {
      if (lifetimeRef.current === lifetime) lifetimeRef.current = undefined;
    };
  }, []);
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });
  const intl = useIntl();
  const waitForTxConfirmResult = useCallback(
    (
      params: Omit<
        Parameters<typeof waitForEarnTransactionConfirm>[0],
        'navigationToTxConfirm' | 'expiredMessage'
      >,
    ) =>
      waitForEarnTransactionConfirm({
        ...params,
        navigationToTxConfirm,
        expiredMessage: intl.formatMessage({
          id: ETranslations.privacy_error_review_expired__msg,
        }),
      }),
    [intl, navigationToTxConfirm],
  );

  return useCallback(
    async ({
      amount,
      symbol,
      term,
      feeRate,
      protocolVault,
      approveType,
      permitSignature,
      unsignedMessage,
      message,
      provider,
      inputTokenAddress,
      outputTokenAddress,
      slippage,
      effectiveApy,
      stakeType,
      taskMode,
      taskAccountAddress,
      resumeTaskState,
      directDepositTask,
      prepareWrappedDeposit,
      beforeDepositTaskSend,
      canSendDepositTask,
      onDepositTaskReady,
      onDepositTaskChange,
      onDepositTaskSettled,
      canRecoverDepositRecording,
      postWrapStakeToken,
      postWrapApproveSpenderAddress,
      stakingInfo,
      onSuccess,
      onFail,
      onStepChange,
      onWrapStateChange,
      isActionCurrent,
      // Stakefish specific param
      validatorPublicKey,
    }: {
      amount: string;
      symbol: string;
      term?: number;
      feeRate?: number;
      protocolVault?: string;
      approveType?: EApproveType;
      permitSignature?: string;
      // Permit2 sign data for Morpho
      unsignedMessage?: IEarnPermit2ApproveSignData;
      // Stakefish: original message for permit signature
      message?: string;
      provider: string;
      inputTokenAddress?: string;
      outputTokenAddress?: string;
      slippage?: number;
      effectiveApy?: string | number;
      stakeType?: IEarnStakeType;
      taskMode?: 'deposit';
      taskAccountAddress?: string;
      resumeTaskState?: IDepositTaskState;
      directDepositTask?: IDirectDepositTaskConfig;
      prepareWrappedDeposit?: IDirectDepositTaskConfig['prepareDeposit'];
      beforeDepositTaskSend?: (
        step: 'wrap' | 'resetApproval' | 'approve' | 'deposit',
      ) => Promise<boolean>;
      canSendDepositTask?: (
        step: 'wrap' | 'resetApproval' | 'approve' | 'deposit',
      ) => boolean;
      onDepositTaskReady?: (handle: IDepositTaskHandle) => boolean | void;
      onDepositTaskChange?: (task: IDepositTask) => void;
      onDepositTaskSettled?: (
        taskId: string,
        txid: string,
      ) => void | Promise<void>;
      canRecoverDepositRecording?: () => boolean;
      postWrapStakeToken?: IToken;
      postWrapApproveSpenderAddress?: string;
      stakingInfo?: IStakingInfo;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
      isActionCurrent?: () => boolean;
      onStepChange?: (
        step: number,
        options?: { shouldShowPostWrapApproveStep?: boolean },
      ) => void;
      onWrapStateChange?: (state: 'submitted' | 'failed' | 'unknown') => void;
      // Stakefish specific param
      validatorPublicKey?: string;
    }) => {
      const lifetime = lifetimeRef.current;
      const isOperationCurrent = () =>
        Boolean(lifetime) &&
        lifetimeRef.current === lifetime &&
        committedScopeRef.current === scope &&
        (isActionCurrent?.() ?? true);
      if (!isOperationCurrent()) return false;
      // OK-59196: one-time risk disclaimer gates the first earn trade on
      // this device; resolves immediately once accepted
      const riskConfirmed = await showEarnRiskWarningDialog({
        provider,
        symbol,
        networkId,
        title: intl.formatMessage({ id: ETranslations.global_warning }),
      });
      if (!riskConfirmed) {
        return false;
      }
      if (!isOperationCurrent()) return false;
      const buildStakeConfirmPayload = async ({
        confirmStakeType = stakeType,
        confirmInputTokenAddress = inputTokenAddress,
        confirmStakingInfo = stakingInfo,
      }: {
        confirmStakeType?: IEarnStakeType;
        confirmInputTokenAddress?: string;
        confirmStakingInfo?: IStakingInfo | null;
      } = {}) => {
        return buildEarnStakeConfirmation({
          request: {
            amount,
            networkId,
            accountId,
            symbol,
            term,
            provider,
            feeRate,
            protocolVault,
            approveType,
            permitSignature,
            unsignedMessage,
            message,
            inputTokenAddress: confirmInputTokenAddress,
            outputTokenAddress,
            slippage,
            effectiveApy,
            stakeType: confirmStakeType,
            validatorPublicKey,
          },
          stakingInfo: confirmStakingInfo,
        });
      };

      if (taskMode === 'deposit' && directDepositTask) {
        wrapAbortRef.current?.controller.abort();
        const controller = new AbortController();
        wrapAbortRef.current = { scope, controller };
        const isCurrent = () =>
          !controller.signal.aborted && isOperationCurrent();
        const accountAddress = await getTaskAccountAddress({
          accountId,
          networkId,
        });
        if (!isCurrent()) return false;
        if (
          !taskAccountAddress ||
          !isTaskAccountAddress(
            { accountAddress: taskAccountAddress, networkId },
            accountAddress,
          )
        ) {
          throw new OneKeyLocalError('Task account changed before preparation');
        }
        const canRecoverRecording = () =>
          Boolean(lifetime) &&
          lifetimeRef.current === lifetime &&
          (canRecoverDepositRecording?.() ?? isCurrent());
        const { token, spenderAddress } = directDepositTask;
        if (
          !inputTokenAddress ||
          inputTokenAddress.toLowerCase() !== token.address.toLowerCase()
        ) {
          throw new OneKeyLocalError('Direct deposit token mismatch');
        }
        return runDirectDepositTask({
          identity: {
            accountId,
            accountAddress,
            networkId,
            provider,
            vault: protocolVault ?? '',
            inputTokenAddress,
            depositTokenAddress: token.address,
            amount,
            spenderAddress,
            intent: {
              symbol,
              outputTokenAddress: outputTokenAddress ?? '',
              depositTokenDecimals: token.decimals,
              term,
              validatorPublicKey,
              slippage,
            },
          },
          token,
          resumeTaskState,
          requiresAllowanceReset: directDepositTask.requiresAllowanceReset,
          signal: controller.signal,
          isCurrent,
          canRecoverRecording,
          confirm: waitForTxConfirmResult,
          confirmReset: directDepositTask.confirmReset,
          prepareDeposit: async (signal) => {
            const result = await directDepositTask.prepareDeposit(signal);
            if (result.type === 'cancelled' || !isCurrent()) {
              return { type: 'cancelled' };
            }
            return {
              type: 'confirm',
              prepared: await buildEarnStakeConfirmation({
                request: {
                  amount,
                  networkId,
                  accountId,
                  symbol,
                  term,
                  provider,
                  feeRate,
                  protocolVault,
                  inputTokenAddress,
                  outputTokenAddress,
                  slippage,
                  effectiveApy: result.effectiveApy,
                  stakeType: 'normal',
                },
                stakingInfo,
              }),
            };
          },
          beforeSendGuard: beforeDepositTaskSend,
          canSendNow: canSendDepositTask,
          onTaskReady: onDepositTaskReady,
          onTaskChange: onDepositTaskChange,
          onTaskSettled: onDepositTaskSettled,
          onDepositSuccess: async (data, stakeInfo, options) =>
            handleTaskStakeSuccess({
              data,
              stakeInfo,
              networkId,
              accountId,
              accountAddress,
              isCurrent: () =>
                isCurrent() && (options?.isRecordingCurrent?.() ?? true),
              lateAfterSettlement: options?.lateAfterSettlement,
              onSuccess,
            }),
          onFail,
          formatMessage: (id) => intl.formatMessage({ id }),
        });
      }

      if (stakeType === 'wrap') {
        wrapAbortRef.current?.controller.abort();
        const controller = new AbortController();
        wrapAbortRef.current = { scope, controller };
        const isCurrent = () =>
          !controller.signal.aborted && isOperationCurrent();
        const canRecoverRecording = () =>
          Boolean(lifetime) &&
          lifetimeRef.current === lifetime &&
          (canRecoverDepositRecording?.() ?? isCurrent());
        if (
          !isValidWrappedStakeToken({
            providerName: provider,
            networkId,
            token: postWrapStakeToken,
          })
        ) {
          throw new OneKeyLocalError('Invalid wrapped stake token');
        }
        if (!postWrapStakeToken?.address || !postWrapApproveSpenderAddress) {
          throw new OneKeyLocalError(
            'Wrap staking requires wrapped token approval config',
          );
        }

        const amountBN = new BigNumber(amount);
        if (!amountBN.isFinite() || amountBN.lte(0)) {
          throw new OneKeyLocalError('Invalid wrap staking amount');
        }

        if (taskMode === 'deposit') {
          const accountAddress = await getTaskAccountAddress({
            accountId,
            networkId,
          });
          if (!isCurrent()) return false;
          if (
            !taskAccountAddress ||
            !isTaskAccountAddress(
              { accountAddress: taskAccountAddress, networkId },
              accountAddress,
            )
          ) {
            throw new OneKeyLocalError(
              'Task account changed before preparation',
            );
          }
          return runWrappedStakeTask({
            accountAddress,
            resumeTaskState,
            request: {
              amount,
              networkId,
              accountId,
              symbol,
              term,
              provider,
              feeRate,
              protocolVault,
              approveType,
              permitSignature,
              unsignedMessage,
              message,
              inputTokenAddress,
              outputTokenAddress,
              slippage,
              effectiveApy,
              stakeType,
              validatorPublicKey,
            },
            stakingInfo,
            wrappedToken: postWrapStakeToken,
            spenderAddress: postWrapApproveSpenderAddress,
            signal: controller.signal,
            isCurrent,
            canRecoverRecording,
            confirm: waitForTxConfirmResult,
            beforeDepositTaskSend,
            canSendDepositTask,
            prepareWrappedDeposit,
            onTaskReady: onDepositTaskReady,
            onTaskChange: onDepositTaskChange,
            onTaskSettled: onDepositTaskSettled,
            onDepositSuccess: async (data, stakeInfo, options) =>
              handleTaskStakeSuccess({
                data,
                stakeInfo,
                networkId,
                accountId,
                accountAddress,
                isCurrent: () =>
                  isCurrent() && (options?.isRecordingCurrent?.() ?? true),
                lateAfterSettlement: options?.lateAfterSettlement,
                onSuccess,
              }),
            onFail,
            formatMessage: (id) => intl.formatMessage({ id }),
          });
        }

        const wrapConfirmPayload = await buildStakeConfirmPayload({
          confirmStakeType: 'wrap',
          // Wrapping only changes the wallet asset and must not record a deposit.
          confirmStakingInfo: null,
        });
        if (!isCurrent()) return false;

        let wrapConfirmResult: ITxConfirmResult;
        try {
          wrapConfirmResult = await waitForTxConfirmResult({
            encodedTx: wrapConfirmPayload.encodedTx,
            stakingInfo: wrapConfirmPayload.stakeInfoWithOrderId,
            useFeeInTx: wrapConfirmPayload.useFeeInTx,
            feeInfoEditable: wrapConfirmPayload.feeInfoEditable,
            isNavigationCurrent: isCurrent,
            signal: controller.signal,
            onConfirmSuccess: () => onWrapStateChange?.('unknown'),
            onUncertainFailure: () => onWrapStateChange?.('unknown'),
          });
        } catch (error) {
          onFail?.(error as Error);
          return false;
        }

        if (!isCurrent() || wrapConfirmResult.status !== 'success') {
          return false;
        }

        await handleStakeSuccess({
          data: wrapConfirmResult.data,
          stakeInfo: wrapConfirmPayload.stakeInfoWithOrderId,
          networkId,
        });

        const wrapTxId =
          wrapConfirmResult.data[0]?.signedTx?.txid ??
          wrapConfirmResult.data[0]?.decodedTx?.txid;
        if (!wrapTxId) {
          Toast.message({
            title: intl.formatMessage({
              id: ETranslations.global_pending,
            }),
          });
          return false;
        }

        const wrapStatus = await waitForTxFinalStatus({
          accountId,
          networkId,
          txid: wrapTxId,
          signal: controller.signal,
        });
        if (!isCurrent()) return false;
        if (wrapStatus !== EOnChainHistoryTxStatus.Success) {
          if (wrapStatus === EOnChainHistoryTxStatus.Failed) {
            onWrapStateChange?.('failed');
          }
          const notify =
            wrapStatus === EOnChainHistoryTxStatus.Failed
              ? Toast.error
              : Toast.message;
          notify({
            title: intl.formatMessage({
              id:
                wrapStatus === EOnChainHistoryTxStatus.Failed
                  ? ETranslations.global_failed
                  : ETranslations.global_pending,
            }),
          });
          return false;
        }
        onWrapStateChange?.('submitted');

        const postWrapStakingInfo = stakingInfo
          ? {
              ...stakingInfo,
              send: stakingInfo.send
                ? {
                    ...stakingInfo.send,
                    token: postWrapStakeToken,
                  }
                : undefined,
            }
          : undefined;

        const fetchPostWrapAllowance = async () => {
          const allowanceInfo =
            await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
              accountId,
              networkId,
              spenderAddress: postWrapApproveSpenderAddress,
              tokenAddress: postWrapStakeToken.address,
            });
          const allowanceBN = new BigNumber(allowanceInfo.allowanceParsed);
          if (!allowanceBN.isFinite() || allowanceBN.lt(0)) {
            throw new OneKeyLocalError('Invalid wrapped token allowance');
          }
          return allowanceBN;
        };
        const waitForPostWrapAllowance = async ({
          maxAttempts = 15,
          intervalMs = 2000,
        }: {
          maxAttempts?: number;
          intervalMs?: number;
        } = {}) => {
          for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            if (!isCurrent()) return false;
            try {
              const latestAllowanceBN = await fetchPostWrapAllowance();
              if (
                !latestAllowanceBN.isNaN() &&
                latestAllowanceBN.gte(amountBN)
              ) {
                return true;
              }
            } catch {
              // Keep polling; a transient allowance read should not abort the
              // post-approve stake step.
            }

            if (attempt < maxAttempts - 1) {
              await timerUtils.wait(intervalMs);
            }
          }

          return false;
        };

        const allowanceBN = await fetchPostWrapAllowance();
        if (!isCurrent()) return false;
        const shouldApprovePostWrapStake = allowanceBN.lt(amountBN);
        onStepChange?.(2, {
          shouldShowPostWrapApproveStep: shouldApprovePostWrapStake,
        });

        await timerUtils.wait(150);
        if (!isCurrent()) return false;

        if (shouldApprovePostWrapStake) {
          const account = await backgroundApiProxy.serviceAccount.getAccount({
            accountId,
            networkId,
          });
          if (!isCurrent()) return false;

          let approveConfirmResult: ITxConfirmResult;
          try {
            approveConfirmResult = await waitForTxConfirmResult({
              approvesInfo: [
                {
                  owner: account.address,
                  spender: postWrapApproveSpenderAddress,
                  amount,
                  tokenInfo: postWrapStakeToken,
                },
              ],
              isNavigationCurrent: isCurrent,
              signal: controller.signal,
            });
          } catch (error) {
            onFail?.(error as Error);
            return false;
          }

          if (!isCurrent() || approveConfirmResult.status !== 'success') {
            return false;
          }

          const approveTxId =
            approveConfirmResult.data[0]?.signedTx?.txid ??
            approveConfirmResult.data[0]?.decodedTx?.txid;
          const approveStatus = approveTxId
            ? await waitForTxFinalStatus({
                accountId,
                networkId,
                txid: approveTxId,
                signal: controller.signal,
              })
            : undefined;
          if (!isCurrent()) return false;
          if (approveStatus !== EOnChainHistoryTxStatus.Success) {
            const notify =
              approveStatus === EOnChainHistoryTxStatus.Failed
                ? Toast.error
                : Toast.message;
            notify({
              title: intl.formatMessage({
                id:
                  approveStatus === EOnChainHistoryTxStatus.Failed
                    ? ETranslations.global_failed
                    : ETranslations.global_pending,
              }),
            });
            return false;
          }

          await timerUtils.wait(150);

          const allowanceReady = await waitForPostWrapAllowance();
          if (!isCurrent()) return false;
          if (!allowanceReady) {
            Toast.message({
              title: intl.formatMessage({
                id: ETranslations.global_pending,
              }),
            });
            return false;
          }

          onStepChange?.(3);
        }

        const normalConfirmPayload = await buildStakeConfirmPayload({
          confirmStakeType: 'normal',
          confirmInputTokenAddress: postWrapStakeToken.address,
          confirmStakingInfo: postWrapStakingInfo,
        });
        if (!isCurrent()) return false;

        await navigationToTxConfirm({
          encodedTx: normalConfirmPayload.encodedTx,
          stakingInfo: normalConfirmPayload.stakeInfoWithOrderId,
          onSuccess: async (data) => {
            await handleStakeSuccess({
              data,
              stakeInfo: normalConfirmPayload.stakeInfoWithOrderId,
              networkId,
              onSuccess,
            });
          },
          onFail,
          useFeeInTx: normalConfirmPayload.useFeeInTx,
          feeInfoEditable: normalConfirmPayload.feeInfoEditable,
          isNavigationCurrent: isCurrent,
        });
        return isCurrent();
      }

      const stakeConfirmPayload = await buildStakeConfirmPayload();
      if (!isOperationCurrent()) return false;

      await navigationToTxConfirm({
        encodedTx: stakeConfirmPayload.encodedTx,
        stakingInfo: stakeConfirmPayload.stakeInfoWithOrderId,
        onSuccess: async (data) => {
          await handleStakeSuccess({
            data,
            stakeInfo: stakeConfirmPayload.stakeInfoWithOrderId,
            networkId,
            onSuccess,
          });
        },
        onFail,
        useFeeInTx: stakeConfirmPayload.useFeeInTx,
        feeInfoEditable: stakeConfirmPayload.feeInfoEditable,
        isNavigationCurrent: isOperationCurrent,
      });

      return isOperationCurrent();
    },
    [
      accountId,
      intl,
      networkId,
      navigationToTxConfirm,
      scope,
      waitForTxConfirmResult,
    ],
  );
}

export function useUniversalWithdraw({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  const intl = useIntl();
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });
  const waitForTxConfirmResult = useCallback(
    async ({
      encodedTx,
      stakingInfo,
      signOnly,
      useFeeInTx,
      feeInfoEditable,
    }: {
      encodedTx?: IEncodedTx;
      stakingInfo?: IStakingInfo;
      signOnly?: boolean;
      useFeeInTx?: boolean;
      feeInfoEditable?: boolean;
    }): Promise<ITxConfirmResult> =>
      new Promise((resolve, reject) => {
        let settled = false;

        const resolveOnce = (result: ITxConfirmResult) => {
          if (settled) {
            return;
          }
          settled = true;
          resolve(result);
        };

        const rejectOnce = (error: unknown) => {
          if (settled) {
            return;
          }
          settled = true;
          reject(error);
        };

        void navigationToTxConfirm({
          encodedTx,
          stakingInfo,
          signOnly,
          useFeeInTx,
          feeInfoEditable,
          onSuccess: (data) => resolveOnce({ status: 'success', data }),
          onFail: (error) => rejectOnce(error),
          onCancel: () => resolveOnce({ status: 'cancel' }),
        }).catch((error) => rejectOnce(error));
      }),
    [navigationToTxConfirm],
  );
  const ensureRiskAccepted = useEarnRiskWarningGate();

  return useCallback(
    async ({
      amount,
      symbol,
      provider,
      identity,
      inputTokenAddress,
      outputTokenAddress,
      protocolVault,
      withdrawAll,
      slippage,
      effectiveApy,
      withdrawType,
      stakingInfo,
      onSuccess,
      onFail,
      // Signature and message for withdraw all
      withdrawSignature,
      withdrawMessage,
      useEthenaCooldown,
      resumeEthenaCooldownUnstake,
      onStepChange,
      onEthenaCooldownUnstakeReady,
      signal,
      isActionCurrent,
      isSendCurrent,
      isResultCurrent,
      taskAccountAddress,
    }: {
      amount: string;
      symbol: string;
      provider: string;
      identity?: string;
      inputTokenAddress?: string;
      outputTokenAddress?: string;
      protocolVault?: string;
      withdrawAll: boolean;
      slippage?: number;
      effectiveApy?: string | number;
      withdrawType?: IEarnWithdrawType;
      stakingInfo?: IStakingInfo;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
      // Signature and message for withdraw all
      withdrawSignature?: string;
      withdrawMessage?: string;
      useEthenaCooldown?: boolean;
      resumeEthenaCooldownUnstake?: boolean;
      onStepChange?: (step: number) => void;
      onEthenaCooldownUnstakeReady?: () => void;
      signal?: AbortSignal;
      isActionCurrent?: () => boolean;
      // A form may reset after handoff, so send lifetime must be provided separately.
      isSendCurrent?: () => boolean;
      isResultCurrent?: () => boolean;
      taskAccountAddress?: string;
    }) => {
      // OK-59196: one-time DeFi risk disclaimer, same gate the earn stake flow
      // uses. Returning false lets the caller tell a rejection apart from a
      // completed hand-off and leave the form untouched.
      if (!(await ensureRiskAccepted({ provider, symbol, networkId }))) {
        return false;
      }
      if (isActionCurrent && !isActionCurrent()) return false;

      const isEtherFi = earnUtils.isEtherFiProvider({ providerName: provider });
      const taskIdentity = isEtherFi
        ? { accountId, networkId, accountAddress: taskAccountAddress ?? '' }
        : undefined;
      if (
        taskIdentity &&
        (!taskIdentity.accountAddress ||
          !(await isTaskAccountCurrent(taskIdentity)))
      )
        throw new OneKeyLocalError('Task account address changed');
      if (isActionCurrent && !isActionCurrent()) return false;

      let stakeTx: IStakeTxResponse | undefined;
      const stakingConfig =
        await backgroundApiProxy.serviceStaking.getStakingConfigs({
          networkId,
          symbol,
          provider,
        });
      if (!stakingConfig) {
        throw new OneKeyLocalError('Staking config not found');
      }
      if (isActionCurrent && !isActionCurrent()) return false;

      if (stakingConfig?.unstakeWithSignMessage) {
        const account = await backgroundApiProxy.serviceAccount.getAccount({
          accountId,
          networkId,
        });
        const { message, deadline } =
          await backgroundApiProxy.serviceStaking.buildLidoEthPermitMessageData(
            {
              accountId,
              networkId,
              amount,
            },
          );

        const signHash =
          (await backgroundApiProxy.serviceDApp.openSignMessageModal({
            accountId,
            networkId,
            request: { origin: 'https://lido.fi/', scope: 'ethereum' },
            unsignedMessage: {
              type: EMessageTypesEth.TYPED_DATA_V4,
              message,
              payload: [account.address, message],
            },
            walletInternalSign: true,
          })) as string;

        stakeTx =
          await backgroundApiProxy.serviceStaking.buildUnstakeTransaction({
            amount,
            networkId,
            accountId,
            symbol,
            provider,
            inputTokenAddress,
            outputTokenAddress,
            effectiveApy,
            withdrawType,
            signature: signHash,
            deadline,
          });
      } else if (useEthenaCooldown) {
        const openEthenaCooldownUnstakeConfirm = async () => {
          const unstakeTx =
            await backgroundApiProxy.serviceStaking.buildUnstakeTransaction({
              amount,
              identity,
              networkId,
              accountId,
              symbol,
              provider,
              inputTokenAddress,
              outputTokenAddress,
              protocolVault,
              withdrawAll,
              useEthenaCooldown: true,
              slippage,
              effectiveApy,
              withdrawType,
            });
          const unstakeEncodedTx =
            await backgroundApiProxy.serviceStaking.buildInternalDappTx({
              networkId,
              accountId,
              tx: unstakeTx.tx,
              internalDappType: EInternalDappEnum.Staking,
              stakingAction: EInternalStakingAction.Withdraw,
            });
          const unstakeStakeInfo = createStakeInfoWithOrderId({
            stakingInfo,
            orderId: unstakeTx.orderId,
          });

          let unstakeConfirmResult;
          try {
            unstakeConfirmResult = await waitForTxConfirmResult({
              encodedTx: unstakeEncodedTx,
              stakingInfo: unstakeStakeInfo,
            });
          } catch (error) {
            onFail?.(error as Error);
            return false;
          }

          if (unstakeConfirmResult.status !== 'success') {
            return false;
          }

          onStepChange?.(3);
          await handleStakeSuccess({
            data: unstakeConfirmResult.data,
            stakeInfo: unstakeStakeInfo,
            networkId,
            onSuccess,
          });
        };

        if (resumeEthenaCooldownUnstake) {
          await openEthenaCooldownUnstakeConfirm();
          return true;
        }

        // Ethena two-step: 1) swap PT-sUSDe → sUSDe, 2) unstake sUSDe → USDe
        const swapTx =
          await backgroundApiProxy.serviceStaking.buildUnstakeTransaction({
            amount,
            identity,
            networkId,
            accountId,
            symbol,
            provider,
            inputTokenAddress,
            outputTokenAddress,
            protocolVault,
            withdrawAll,
            ethenaPath: true,
            slippage,
            effectiveApy,
            withdrawType,
          });
        const swapEncodedTx =
          await backgroundApiProxy.serviceStaking.buildInternalDappTx({
            networkId,
            accountId,
            tx: swapTx.tx,
            internalDappType: EInternalDappEnum.Staking,
            stakingAction: EInternalStakingAction.Withdraw,
          });
        const swapStakeInfo = createStakeInfoWithOrderId({
          stakingInfo,
          orderId: swapTx.orderId,
        });
        let swapConfirmResult;
        try {
          swapConfirmResult = await waitForTxConfirmResult({
            encodedTx: swapEncodedTx,
            stakingInfo: swapStakeInfo,
          });
        } catch (error) {
          onFail?.(error as Error);
          return false;
        }

        if (swapConfirmResult.status !== 'success') {
          return false;
        }

        await handleStakeSuccess({
          data: swapConfirmResult.data,
          stakeInfo: swapStakeInfo,
          networkId,
        });

        if (signal?.aborted) {
          return false;
        }

        onStepChange?.(2);

        const swapTxId =
          swapConfirmResult.data[0]?.signedTx?.txid ??
          swapConfirmResult.data[0]?.decodedTx?.txid;
        if (swapTxId) {
          const swapStatus = await waitForTxFinalStatus({
            accountId,
            networkId,
            txid: swapTxId,
            signal,
          });
          if (swapStatus !== EOnChainHistoryTxStatus.Success) {
            if (!signal?.aborted) {
              Toast.error({
                title: intl.formatMessage({
                  id: ETranslations.global_failed,
                }),
              });
            }
            return false;
          }
        }

        if (signal?.aborted) {
          return false;
        }

        onEthenaCooldownUnstakeReady?.();

        // Let the previous confirm modal finish closing before opening
        // the next step so each tx confirm owns the stack serially.
        await timerUtils.wait(150);

        if (signal?.aborted) {
          return false;
        }

        await openEthenaCooldownUnstakeConfirm();
        return true;
      } else {
        stakeTx =
          await backgroundApiProxy.serviceStaking.buildUnstakeTransaction({
            amount,
            identity,
            networkId,
            accountId,
            symbol,
            provider,
            inputTokenAddress,
            outputTokenAddress,
            protocolVault,
            withdrawAll,
            signature: withdrawSignature,
            message: withdrawMessage,
            slippage,
            effectiveApy,
            withdrawType,
            ...(taskIdentity
              ? { expectedAccountAddress: taskIdentity.accountAddress }
              : {}),
          });
      }

      if (isActionCurrent && !isActionCurrent()) return false;
      // Handle Stakefish validator exit broadcast (no on-chain tx needed)
      const txAsExitBroadcast =
        stakeTx.tx as unknown as IStakeTxStakefishExitBroadcast;
      if (txAsExitBroadcast?.exitBroadcasted === true) {
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.feedback_transaction_submitted,
          }),
        });
        if ((isResultCurrent ?? isSendCurrent)?.() ?? true) onSuccess?.([]);
        return true;
      }

      const encodedTx =
        await backgroundApiProxy.serviceStaking.buildInternalDappTx({
          networkId,
          accountId,
          tx: stakeTx.tx,
          internalDappType: EInternalDappEnum.Staking,
          stakingAction: EInternalStakingAction.Withdraw,
        });
      if (isActionCurrent && !isActionCurrent()) return false;
      if (
        taskIdentity &&
        ((typeof encodedTx === 'object' &&
          encodedTx !== null &&
          'from' in encodedTx &&
          !isTaskEncodedTxOwner(taskIdentity, encodedTx)) ||
          !(await isTaskAccountCurrent(taskIdentity)))
      )
        throw new OneKeyLocalError('Task transaction account mismatch');
      if (isActionCurrent && !isActionCurrent()) return false;
      let useFeeInTx;
      let feeInfoEditable;
      if (
        networkUtils.isBTCNetwork(networkId) &&
        (encodedTx as IEncodedTxBtc).fee
      ) {
        useFeeInTx = true;
        feeInfoEditable = false;
      }

      const stakeInfoWithOrderId = createStakeInfoWithOrderId({
        stakingInfo,
        orderId: stakeTx.orderId,
      });

      const recordLateOrder = taskIdentity
        ? createLateEarnOrderRecorder()
        : undefined;
      let acceptedTxid: string | undefined;
      await navigationToTxConfirm({
        encodedTx,
        isNavigationCurrent: isActionCurrent,
        onBeforeSend:
          isSendCurrent || taskIdentity
            ? async () => {
                if (
                  (isSendCurrent && !isSendCurrent()) ||
                  (taskIdentity &&
                    !(await isTaskAccountCurrent(taskIdentity))) ||
                  (isSendCurrent && !isSendCurrent())
                ) {
                  throw new OneKeyLocalError(
                    intl.formatMessage({
                      id: ETranslations.privacy_error_review_expired__msg,
                    }),
                  );
                }
              }
            : undefined,
        onLateBroadcastAccepted: recordLateOrder
          ? async (fact) => {
              if (
                fact.accountId !== accountId ||
                fact.networkId !== networkId ||
                !fact.uuid.trim() ||
                !fact.txid.trim()
              )
                return;
              if (acceptedTxid) return;
              acceptedTxid = fact.txid;
              const recordParams = {
                fact,
                accountId,
                networkId,
                stakeInfo: stakeInfoWithOrderId,
              };
              let result = await recordLateOrder(recordParams);
              if (result === 'localFailed' || result === 'localUnavailable') {
                result = await recordLateOrder(recordParams);
              }
              if (
                result !== 'synced' &&
                result !== 'notTracked' &&
                result !== 'superseded' &&
                (isResultCurrent ?? isSendCurrent)?.()
              )
                errorToastUtils.showToastOfError(
                  new OneKeyLocalError(
                    'Earn order synchronization is incomplete',
                  ),
                );
            }
          : undefined,
        stakingInfo: stakeInfoWithOrderId,
        signOnly: stakingConfig?.withdrawSignOnly,
        useFeeInTx,
        feeInfoEditable,
        onSuccess: async (data) => {
          if (recordLateOrder) {
            if (acceptedTxid) return;
            const txid = data[0]?.signedTx?.txid || data[0]?.decodedTx?.txid;
            if (txid) acceptedTxid = txid;
          }
          if (!stakingConfig?.withdrawSignOnly) {
            if (!isSendCurrent && !isResultCurrent && !taskIdentity) {
              await handleStakeSuccess({
                data,
                stakeInfo: stakeInfoWithOrderId,
                networkId,
                onSuccess,
              });
              return;
            }
            try {
              await handleStakeSuccess({
                data,
                stakeInfo: stakeInfoWithOrderId,
                networkId,
              });
            } catch (error) {
              errorToastUtils.showToastOfError(error);
            }
            let accountCurrent = true;
            if (taskIdentity) {
              try {
                accountCurrent = await isTaskAccountCurrent(taskIdentity);
              } catch {
                accountCurrent = false;
              }
            }
            if (
              accountCurrent &&
              ((isResultCurrent ?? isSendCurrent)?.() ?? true)
            ) {
              onSuccess?.(data);
            }
          } else {
            const psbtHex = data[0].signedTx.finalizedPsbtHex;
            if (psbtHex && identity) {
              await backgroundApiProxy.serviceStaking.unstakePush({
                txId: identity,
                networkId,
                accountId,
                symbol,
                provider,
                unstakeTxHex: psbtHex,
              });
              if ((isResultCurrent ?? isSendCurrent)?.() ?? true)
                onSuccess?.(data);
            }
          }
        },
        onFail,
      });

      return isActionCurrent?.() ?? true;
    },
    [
      accountId,
      ensureRiskAccepted,
      networkId,
      navigationToTxConfirm,
      waitForTxConfirmResult,
      intl,
    ],
  );
}

export function useUniversalClaim({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });
  const showClaimEstimateGasAlert = useShowClaimEstimateGasAlert();
  const ensureRiskAccepted = useEarnRiskWarningGate();

  return useCallback(
    async ({
      identity,
      amount,
      provider,
      claimTokenAddress,
      claimType,
      protocolVault,
      vault,
      symbol,
      stakingInfo,
      onSuccess,
      onFail,
    }: {
      identity?: string;
      amount: string;
      symbol: string;
      provider: string;
      claimTokenAddress?: string;
      claimType?: IEarnClaimType;
      protocolVault?: string;
      stakingInfo?: IStakingInfo;
      vault: string;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
      portfolioSymbol?: string;
      portfolioRewardSymbol?: string;
    }) => {
      const amountNumber = BigNumber(amount || 0);
      const normalizedAmount = amountNumber.isNaN()
        ? '0'
        : amountNumber.toFixed();
      // OK-59196: one-time DeFi risk disclaimer, same gate the earn stake flow
      // uses.
      if (!(await ensureRiskAccepted({ provider, symbol, networkId }))) {
        return false;
      }

      const continueClaim = async () => {
        const stakeTx =
          await backgroundApiProxy.serviceStaking.buildClaimTransaction({
            networkId,
            accountId,
            symbol,
            provider,
            amount: normalizedAmount,
            identity,
            claimTokenAddress,
            claimType,
            vault,
          });
        const encodedTx =
          await backgroundApiProxy.serviceStaking.buildInternalDappTx({
            networkId,
            accountId,
            tx: stakeTx.tx,
            internalDappType: EInternalDappEnum.Staking,
            stakingAction: EInternalStakingAction.Claim,
          });
        let useFeeInTx;
        let feeInfoEditable;
        if (
          networkUtils.isBTCNetwork(networkId) &&
          (encodedTx as IEncodedTxBtc).fee
        ) {
          useFeeInTx = true;
          feeInfoEditable = false;
        }

        const stakeInfoWithOrderId = createStakeInfoWithOrderId({
          stakingInfo,
          orderId: stakeTx.orderId,
        });

        await navigationToTxConfirm({
          encodedTx,
          stakingInfo: stakeInfoWithOrderId,
          onSuccess: async (data) => {
            await handleStakeSuccess({
              data,
              stakeInfo: stakeInfoWithOrderId,
              networkId,
              onSuccess,
            });
          },
          onFail,
          useFeeInTx,
          feeInfoEditable,
        });
      };
      if (amountNumber.gt(0)) {
        const account = await backgroundApiProxy.serviceAccount.getAccount({
          accountId,
          networkId,
        });
        const estimateFeeResp =
          await backgroundApiProxy.serviceStaking.estimateFee({
            networkId,
            provider,
            symbol,
            action: 'claim',
            amount: normalizedAmount,
            protocolVault,
            identity,
            accountAddress: account.address,
          });
        // Only check gas fee vs claim value if token price is available
        if (estimateFeeResp.token?.price) {
          const tokenFiatValueBN = BigNumber(
            estimateFeeResp.token.price,
          ).multipliedBy(normalizedAmount);
          if (tokenFiatValueBN.lt(estimateFeeResp.feeFiatValue)) {
            showClaimEstimateGasAlert({
              claimTokenFiatValue: tokenFiatValueBN.toFixed(),
              estFiatValue: estimateFeeResp.feeFiatValue,
              onConfirm: continueClaim,
            });
            // The alert owns the flow from here; it either continues or the
            // user dismisses it, so the hand-off counts as started.
            return true;
          }
        }
      }
      await continueClaim();

      return true;
    },
    [
      ensureRiskAccepted,
      navigationToTxConfirm,
      accountId,
      networkId,
      showClaimEstimateGasAlert,
    ],
  );
}
