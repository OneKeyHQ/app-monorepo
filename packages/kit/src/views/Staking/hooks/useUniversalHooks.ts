import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { type IntlShape, useIntl } from 'react-intl';

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
  type IClaimApproveInfo,
  type IClaimFollowUpInfo,
  type IEarnClaimType,
  type IEarnPermit2ApproveSignData,
  type IEarnStakeType,
  type IEarnUtmParams,
  type IEarnWithdrawType,
  type IStakeTxResponse,
  type IStakeTxStakefishExitBroadcast,
  type IStakingInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { runClaimConversion } from '../components/ClaimConversionDialog';
import {
  showEarnRiskWarningDialog,
  useEarnRiskWarningGate,
} from '../components/EarnRiskWarningDialog';
import { useShowClaimEstimateGasAlert } from '../components/EstimateNetworkFee';
import { showServerExecutedOrderDialog } from '../components/ServerExecutedOrderDialog';
import { runDirectDepositTask } from '../earnDepositTask/directDepositTask';
import {
  getTaskAccountAddress,
  isTaskAccountAddress,
  isTaskAccountCurrent,
  isTaskEncodedTxOwner,
} from '../earnDepositTask/taskAccount';
import {
  buildEarnStakeConfirmation,
  buildEarnStakeConfirmationOrServerOrder,
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

/**
 * Server-executed order (OK-61790, Unitas): the stake / unstake response
 * carries `tx: null` and an orderId. The order stays tracked server side when
 * the user closes the dialog before it reaches a final state.
 */
const handleServerExecutedOrder = async ({
  orderId,
  networkId,
  accountId,
  intl,
  onSuccess,
  onFail,
  isCurrent,
  isResultCurrent,
  provider,
  vault,
}: {
  orderId: string;
  networkId: string;
  accountId: string;
  intl: IntlShape;
  provider: string;
  vault?: string;
  isCurrent?: () => boolean;
  isResultCurrent?: () => boolean;
  onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
  onFail?: IModalSendParamList['SendConfirm']['onFail'];
}) => {
  const trackDetachedOrder = () => {
    void backgroundApiProxy.serviceStaking
      .waitForServerExecutedOrder({
        orderId,
        networkId,
        accountId,
        refreshScope: { provider, vault },
      })
      .catch(() => undefined);
  };
  if (isCurrent && !isCurrent()) {
    trackDetachedOrder();
    return false;
  }
  const order = await showServerExecutedOrderDialog({
    orderId,
    networkId,
    accountId,
  });
  const isResultStillCurrent = isResultCurrent ?? isCurrent;
  if (isResultStillCurrent && !isResultStillCurrent()) {
    trackDetachedOrder();
    return false;
  }
  if (order?.status === 'failed') {
    onFail?.(
      new OneKeyLocalError(
        order.errorMessage ??
          intl.formatMessage({ id: ETranslations.global_failed }),
      ),
    );
    return false;
  }
  onSuccess?.([]);
  return true;
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
      utm,
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
      // Campaign attribution, forwarded to the server unchanged
      utm?: IEarnUtmParams;
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
        return buildEarnStakeConfirmationOrServerOrder({
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
            ...utm,
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

        await backgroundApiProxy.serviceStaking.assertEarnApproval({
          accountId,
          networkId,
          provider,
          symbol,
          vault: protocolVault,
          action: 'stake',
          tokenAddress: postWrapStakeToken.address,
          spenderAddress: postWrapApproveSpenderAddress,
        });
        if (!isCurrent()) return false;
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
        if ('serverOrderId' in wrapConfirmPayload) {
          throw new OneKeyLocalError(
            'Native wrap staking cannot be executed by the protocol',
          );
        }

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
        if (typeof normalConfirmPayload.serverOrderId === 'string') {
          return handleServerExecutedOrder({
            orderId: normalConfirmPayload.serverOrderId,
            isCurrent,
            provider,
            vault: protocolVault,
            networkId,
            accountId,
            intl,
            onSuccess,
            onFail,
          });
        }
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
      if (typeof stakeConfirmPayload.serverOrderId === 'string') {
        return handleServerExecutedOrder({
          orderId: stakeConfirmPayload.serverOrderId,
          isCurrent: isOperationCurrent,
          provider,
          vault: protocolVault,
          networkId,
          accountId,
          intl,
          onSuccess,
          onFail,
        });
      }
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
      utm,
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
      // Campaign attribution, forwarded to the server unchanged
      utm?: IEarnUtmParams;
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
            ...utm,
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
              ...utm,
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
            ...utm,
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
            ...utm,
            withdrawType,
            ...(taskIdentity
              ? { expectedAccountAddress: taskIdentity.accountAddress }
              : {}),
          });
      }

      if (!stakeTx.tx) {
        if (!stakeTx.orderId) {
          if (isActionCurrent && !isActionCurrent()) return false;
          throw new OneKeyLocalError(
            'Unstake response has neither a transaction nor an orderId',
          );
        }
        // Unitas gold-vault redeem: submitted by the protocol after the receipt
        // approve
        return handleServerExecutedOrder({
          orderId: stakeTx.orderId,
          isCurrent: isActionCurrent,
          isResultCurrent: isResultCurrent ?? isSendCurrent ?? isActionCurrent,
          provider,
          vault: protocolVault,
          networkId,
          accountId,
          intl,
          onSuccess,
          onFail,
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
  const intl = useIntl();
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
      claimApprove,
      claimFollowUp,
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
      /** Allowance the claim needs first (Unitas USDu), from the claimable list. */
      claimApprove?: IClaimApproveInfo;
      /** Server-executed step that follows the claim, from the claimable list. */
      claimFollowUp?: IClaimFollowUpInfo;
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

      // OK-61790 (Unitas USDu): the claimed USDu is converted back to USDT by
      // the protocol right after the claim, which needs an allowance of the
      // claimed amount. Ask for it before the claim transaction when missing.
      if (claimApprove && amountNumber.gt(0)) {
        // Invalid metadata must not fall through as an allowance RPC failure.
        await backgroundApiProxy.serviceStaking.assertEarnApproval({
          accountId,
          networkId,
          provider,
          symbol,
          vault: protocolVault || vault,
          action: 'claim',
          tokenAddress: claimApprove.tokenAddress,
          spenderAddress: claimApprove.approveTarget,
        });
        const readAllowance = async () => {
          const info =
            await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
              networkId,
              accountId,
              tokenAddress: claimApprove.tokenAddress,
              spenderAddress: claimApprove.approveTarget,
            });
          return new BigNumber(info.allowanceParsed || '0');
        };
        let allowance = new BigNumber(0);
        try {
          allowance = await readAllowance();
        } catch {
          // Unreadable allowance: fall through to the approve so the claim is
          // never left without its conversion.
        }
        if (allowance.lt(amountNumber)) {
          const account = await backgroundApiProxy.serviceAccount.getAccount({
            accountId,
            networkId,
          });
          const tokenInfo: IToken = {
            address: claimApprove.tokenAddress,
            symbol: claimApprove.symbol,
            name: claimApprove.symbol,
            decimals: claimApprove.decimals,
            isNative: false,
            networkId,
          };
          let approveStatus: 'success' | 'cancel';
          try {
            approveStatus = await new Promise<'success' | 'cancel'>(
              (resolve, reject) => {
                void navigationToTxConfirm({
                  approvesInfo: [
                    {
                      owner: account.address,
                      spender: claimApprove.approveTarget,
                      amount: normalizedAmount,
                      tokenInfo,
                    },
                  ],
                  onSuccess: () => resolve('success'),
                  onFail: (error) => reject(error),
                  onCancel: () => resolve('cancel'),
                }).catch((error) => reject(error));
              },
            );
          } catch (error) {
            onFail?.(error as Error);
            return false;
          }
          if (approveStatus !== 'success') {
            return false;
          }
          // The approve was just broadcast; wait for the allowance to land
          // before building the claim so the server-side conversion can run.
          let allowanceReady = false;
          for (let attempt = 0; attempt < 15; attempt += 1) {
            await timerUtils.wait(2000);
            try {
              if ((await readAllowance()).gte(amountNumber)) {
                allowanceReady = true;
                break;
              }
            } catch {
              // keep polling
            }
          }
          if (!allowanceReady) {
            Toast.error({
              title: intl.formatMessage({ id: ETranslations.global_failed }),
            });
            return false;
          }
          await timerUtils.wait(150);
        }
      }

      const continueClaim = async () => {
        const claimRequest = {
          networkId,
          accountId,
          symbol,
          provider,
          amount: normalizedAmount,
          claimTokenAddress,
          claimType,
          vault,
        };
        // This claim is the conversion itself (OK-61790, Unitas: USDu already
        // in the wallet, left there by a conversion that did not finish). The
        // server runs it, so there is nothing to sign: ask for it and wait
        // under the conversion dialog, which also offers another try.
        if (claimFollowUp && claimFollowUp.identity === identity) {
          const outcome = await runClaimConversion({
            intl,
            request: { ...claimRequest, identity: claimFollowUp.identity },
            symbol,
            amount: normalizedAmount,
            withClaimStep: false,
          });
          // A failure the user gave up on leaves the amount claimable, so the
          // page stays as it is; anything else moved the position.
          if (outcome !== 'failed') {
            onSuccess?.([]);
          }
          return;
        }
        const stakeTx =
          await backgroundApiProxy.serviceStaking.buildClaimTransaction({
            ...claimRequest,
            identity,
          });
        // Any other claim the server runs itself: wait for the order under a
        // dialog, the same as a server-executed stake.
        if (!stakeTx.tx) {
          if (!stakeTx.orderId) {
            throw new OneKeyLocalError('Claim returned neither tx nor order');
          }
          await handleServerExecutedOrder({
            orderId: stakeTx.orderId,
            provider,
            vault,
            networkId,
            accountId,
            intl,
            onSuccess,
            onFail,
          });
          return;
        }
        // The claim is followed by a server-executed step (Unitas: the USDu it
        // pays out is converted back to USDT) unless this claim is that step.
        const followUpIdentity =
          claimFollowUp && claimFollowUp.identity !== identity
            ? claimFollowUp.identity
            : undefined;
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
            // Report the claim transaction first: the server only runs the
            // follow-up for a claim it knows about. The caller's onSuccess is
            // held back until the follow-up settles, so the page refreshes
            // once, onto the final state.
            await handleStakeSuccess({
              data,
              stakeInfo: stakeInfoWithOrderId,
              networkId,
              onSuccess: followUpIdentity ? undefined : onSuccess,
            });
            if (!followUpIdentity) {
              return;
            }
            // Whatever the conversion does, the claim itself went through:
            // the page refreshes once the dialog is done with.
            await runClaimConversion({
              intl,
              request: { ...claimRequest, identity: followUpIdentity },
              symbol,
              amount: normalizedAmount,
              withClaimStep: true,
            });
            onSuccess?.(data);
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
      intl,
      showClaimEstimateGasAlert,
    ],
  );
}
