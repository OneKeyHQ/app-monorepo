import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { createLateDepositOrderRecorder } from './lateDepositOrder';
import { createDepositRecording, runDepositTask } from './runDepositTask';
import {
  createDepositTask,
  createDepositTaskState,
  isDepositRecordingBound,
  isSameDepositTaskIdentity,
} from './state';
import {
  isTaskAccountAddress,
  isTaskAccountCurrent,
  isTaskEncodedTxOwner,
} from './taskAccount';
import { waitForDepositTaskTxStatus } from './waitForDepositTaskTxStatus';

import type { IDepositTaskAdapter } from './controller';
import type { IRecordingResult } from './runDepositTask';
import type {
  IDepositTask,
  IDepositTaskIdentity,
  IDepositTaskState,
} from './state';
import type { buildEarnStakeConfirmation } from './transactionBuilder';
import type { waitForEarnTransactionConfirm } from './transactionConfirm';
import type { IDepositTaskHandle } from './types';

type IConfirmParams = Omit<
  Parameters<typeof waitForEarnTransactionConfirm>[0],
  'navigationToTxConfirm' | 'expiredMessage'
>;
type IDepositPayload = Awaited<ReturnType<typeof buildEarnStakeConfirmation>>;
type IDirectStep = 'resetApproval' | 'approve' | 'deposit';
type IPrepared =
  | { kind: 'deposit'; payload: IDepositPayload }
  | { kind: 'approval'; approvesInfo: IApproveInfo[] };

export async function runDirectDepositTask({
  identity,
  token,
  requiresAllowanceReset,
  signal,
  isCurrent,
  canRecoverRecording,
  confirm,
  confirmReset,
  prepareDeposit,
  beforeSendGuard,
  canSendNow,
  onTaskReady,
  onTaskChange,
  onTaskSettled,
  resumeTaskState,
  onDepositSuccess,
  onFail,
  formatMessage,
}: {
  identity: IDepositTaskIdentity;
  token: IToken;
  requiresAllowanceReset: boolean;
  signal: AbortSignal;
  isCurrent: () => boolean;
  canRecoverRecording?: () => boolean;
  confirm: (
    params: IConfirmParams,
  ) => ReturnType<typeof waitForEarnTransactionConfirm>;
  confirmReset?: (signal: AbortSignal) => Promise<boolean>;
  prepareDeposit: (
    signal: AbortSignal,
  ) => Promise<
    { type: 'confirm'; prepared: IDepositPayload } | { type: 'cancelled' }
  >;
  beforeSendGuard?: (step: IDirectStep) => Promise<boolean>;
  canSendNow?: (step: IDirectStep) => boolean;
  onTaskReady?: (handle: IDepositTaskHandle) => boolean | void;
  onTaskChange?: (task: IDepositTask) => void;
  onTaskSettled?: (taskId: string, txid: string) => void | Promise<void>;
  resumeTaskState?: IDepositTaskState;
  onDepositSuccess: (
    data: ISendTxOnSuccessData[],
    stakeInfo?: IStakingInfo,
    options?: {
      lateAfterSettlement: boolean;
      isRecordingCurrent?: () => boolean;
    },
  ) => Promise<IRecordingResult>;
  onFail?: (error: Error) => void;
  formatMessage: (id: ETranslations) => string;
}): Promise<boolean> {
  const { accountId, networkId, amount, spenderAddress } = identity;
  const amountBN = new BigNumber(amount);
  const decimals = amountBN.decimalPlaces();
  if (
    !accountId ||
    !networkId ||
    !spenderAddress ||
    !token.address ||
    token.isNative ||
    token.address.toLowerCase() !==
      identity.depositTokenAddress.toLowerCase() ||
    token.address.toLowerCase() !== identity.inputTokenAddress.toLowerCase() ||
    !Number.isInteger(token.decimals) ||
    token.decimals < 0 ||
    !amountBN.isFinite() ||
    amountBN.lte(0) ||
    decimals === null ||
    decimals > token.decimals
  ) {
    throw new OneKeyLocalError('Invalid direct deposit task identity');
  }
  const steps: { id: string; kind: IDirectStep }[] = [];
  if (requiresAllowanceReset)
    steps.push({ id: 'resetApproval', kind: 'resetApproval' });
  steps.push(
    { id: 'approve', kind: 'approve' },
    { id: 'deposit', kind: 'deposit' },
  );
  const retainedTask = resumeTaskState?.getTask();
  if (
    retainedTask &&
    !isSameDepositTaskIdentity(retainedTask.identity, identity)
  ) {
    throw new OneKeyLocalError('Retained deposit task identity mismatch');
  }
  const task =
    retainedTask ??
    createDepositTask({ taskId: generateUUID(), identity, steps });
  const taskState = resumeTaskState ?? createDepositTaskState(task);
  const isTaskCurrent = () => !signal.aborted && isCurrent();
  const recordLateOrder = createLateDepositOrderRecorder();
  const recording = createDepositRecording({
    isCurrent: canRecoverRecording ?? isTaskCurrent,
    onError: (error) => {
      if (onFail && error instanceof Error) onFail(error);
      else errorToastUtils.showToastOfError(error);
    },
  });
  const fetchAllowance = async () => {
    const response =
      await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
        accountId,
        networkId,
        expectedAccountAddress: identity.accountAddress,
        spenderAddress,
        tokenAddress: token.address,
      });
    const value = new BigNumber(response.allowanceParsed);
    if (!value.isFinite() || value.isNegative()) {
      throw new OneKeyLocalError('Invalid token allowance');
    }
    return value;
  };
  const adapter: IDepositTaskAdapter<IPrepared> = {
    prepare: async ({ step, isRetry, signal: taskSignal }) => {
      const isStepCurrent = () => !taskSignal.aborted && isTaskCurrent();
      if (!isStepCurrent()) return { type: 'cancelled' };
      if (step.kind === 'deposit') {
        if (isRetry) {
          const allowance = await fetchAllowance();
          if (!isStepCurrent()) return { type: 'cancelled' };
          if (allowance.lt(amountBN)) {
            return {
              type: 'insertApproval',
              approvalStepId: `approve:${generateUUID()}`,
              resetStepId: requiresAllowanceReset
                ? `resetApproval:${generateUUID()}`
                : undefined,
            };
          }
        }
        const result = await prepareDeposit(taskSignal);
        if (!isStepCurrent() || result.type === 'cancelled')
          return { type: 'cancelled' };
        return {
          type: 'confirm',
          prepared: { kind: 'deposit', payload: result.prepared },
        };
      }
      if (step.kind !== 'resetApproval' && step.kind !== 'approve') {
        throw new OneKeyLocalError('Unsupported direct deposit task step');
      }
      const allowance = await fetchAllowance();
      if (!isStepCurrent()) return { type: 'cancelled' };
      if (step.kind === 'resetApproval') {
        if (allowance.isZero() || allowance.gte(amountBN))
          return { type: 'skip' };
        if (confirmReset && !(await confirmReset(taskSignal)))
          return { type: 'cancelled' };
        if (!isStepCurrent()) return { type: 'cancelled' };
      } else {
        if (allowance.gte(amountBN)) return { type: 'skip' };
        if (requiresAllowanceReset && !allowance.isZero()) {
          if (isRetry) {
            return {
              type: 'insertReset',
              resetStepId: `resetApproval:${generateUUID()}`,
            };
          }
          throw new OneKeyLocalError(
            'Token allowance must be reset before approval',
          );
        }
      }
      const account = await backgroundApiProxy.serviceAccount.getAccount({
        accountId,
        networkId,
      });
      if (!isStepCurrent()) return { type: 'cancelled' };
      if (!isTaskAccountAddress(identity, account.address)) {
        throw new OneKeyLocalError('Task account changed before approval');
      }
      return {
        type: 'confirm',
        prepared: {
          kind: 'approval',
          approvesInfo: [
            {
              owner: account.address,
              spender: spenderAddress,
              amount: step.kind === 'resetApproval' ? '0' : amount,
              isMax: step.kind === 'resetApproval' ? false : undefined,
              tokenInfo: token,
            },
          ],
        },
      };
    },
    beforeConfirm: async ({ step }) => {
      if (
        step.kind !== 'resetApproval' &&
        step.kind !== 'approve' &&
        step.kind !== 'deposit'
      )
        return false;
      return beforeSendGuard ? beforeSendGuard(step.kind) : true;
    },
    confirm: async ({
      taskId,
      attemptId,
      step,
      prepared,
      signal: taskSignal,
      onBeforeSend,
      onSendBlocked,
      onSubmitted,
      onLateBroadcastAccepted,
    }) => {
      if (
        step.kind !== 'resetApproval' &&
        step.kind !== 'approve' &&
        step.kind !== 'deposit'
      ) {
        throw new OneKeyLocalError('Unsupported direct deposit task step');
      }
      const kind = step.kind;
      const payload =
        prepared.kind === 'deposit' ? prepared.payload : undefined;
      if (payload && !isTaskEncodedTxOwner(identity, payload.encodedTx)) {
        throw new OneKeyLocalError('Task transaction account mismatch');
      }
      let depositReported = false;
      let recordPromise: Promise<void> | undefined;
      const result = await confirm({
        encodedTx: payload?.encodedTx,
        stakingInfo: payload?.stakeInfoWithOrderId,
        useFeeInTx: payload?.useFeeInTx,
        feeInfoEditable: payload?.feeInfoEditable,
        approvesInfo:
          prepared.kind === 'approval' ? prepared.approvesInfo : undefined,
        allowDeviceRejectionRetry:
          networkId === getNetworkIdsMap().eth &&
          earnUtils.isEtherFiProvider({ providerName: identity.provider }),
        isNavigationCurrent: isTaskCurrent,
        signal: taskSignal,
        canSendNow: canSendNow ? () => canSendNow(kind) : undefined,
        beforeSendGuard: async () => {
          if (beforeSendGuard && !(await beforeSendGuard(kind))) {
            throw new OneKeyLocalError(
              formatMessage(ETranslations.privacy_error_review_expired__msg),
            );
          }
          if (!isTaskCurrent() || taskSignal.aborted) {
            throw new OneKeyLocalError(
              formatMessage(ETranslations.privacy_error_review_expired__msg),
            );
          }
          if (kind === 'deposit' || requiresAllowanceReset) {
            const allowance = await fetchAllowance();
            if (!isTaskCurrent() || taskSignal.aborted) {
              throw new OneKeyLocalError(
                formatMessage(ETranslations.privacy_error_review_expired__msg),
              );
            }
            if (kind === 'deposit' && allowance.lt(amountBN)) {
              throw new OneKeyLocalError(
                'Token allowance changed before deposit',
              );
            }
            if (
              (kind === 'resetApproval' &&
                (allowance.isZero() || allowance.gte(amountBN))) ||
              (requiresAllowanceReset &&
                kind === 'approve' &&
                !allowance.isZero())
            ) {
              throw new OneKeyLocalError(
                'Token allowance changed before approval',
              );
            }
          }
          if (
            !(await isTaskAccountCurrent(identity)) ||
            (canSendNow && !canSendNow(kind)) ||
            !isTaskCurrent() ||
            taskSignal.aborted
          ) {
            throw new OneKeyLocalError(
              formatMessage(ETranslations.privacy_error_review_expired__msg),
            );
          }
        },
        onSendStarted: onBeforeSend,
        onSendBlocked,
        onLateBroadcastAccepted: async (fact) => {
          if (
            fact.accountId !== identity.accountId ||
            fact.networkId !== identity.networkId ||
            !fact.uuid.trim() ||
            !onLateBroadcastAccepted(fact.txid)
          )
            return;
          if (kind === 'deposit' && !depositReported) {
            depositReported = true;
            recordPromise = recording.start(
              fact.txid,
              () =>
                isDepositRecordingBound(
                  taskState.getTask(),
                  { taskId, stepId: step.id, attemptId },
                  fact.txid,
                )
                  ? recordLateOrder({
                      fact,
                      accountId,
                      networkId,
                      stakeInfo: payload?.stakeInfoWithOrderId,
                    })
                  : Promise.resolve('remoteUnknown' as const),
              () => undefined,
              { taskId, stepId: step.id, attemptId },
            );
            await recordPromise;
          }
        },
        onSubmitted: (data, options) => {
          const txid =
            data[0]?.signedTx?.txid?.trim() ||
            data[0]?.decodedTx?.txid?.trim() ||
            '';
          const accepted = onSubmitted(txid);
          if (kind === 'deposit' && txid && accepted && !depositReported) {
            depositReported = true;
            recordPromise = recording.start(
              txid,
              () =>
                isDepositRecordingBound(
                  taskState.getTask(),
                  { taskId, stepId: step.id, attemptId },
                  txid,
                )
                  ? onDepositSuccess(data, payload?.stakeInfoWithOrderId, {
                      lateAfterSettlement: Boolean(
                        options?.lateAfterSettlement || !isTaskCurrent(),
                      ),
                      isRecordingCurrent: recording.isActive,
                    })
                  : Promise.resolve('remoteUnknown' as const),
              () => onTaskSettled?.(task.taskId, txid),
              { taskId, stepId: step.id, attemptId },
            );
          }
        },
      });
      if (result.status === 'cancel') return { type: 'cancelled' };
      if (recordPromise) await recordPromise;
      return { type: 'submitted' };
    },
    waitForFinalStatus: async ({ txid, signal: taskSignal }) => {
      return waitForDepositTaskTxStatus({
        identity: task.identity,
        txid,
        signal: taskSignal,
      });
    },
    verify: async ({ step, signal: taskSignal }) => {
      if (step.kind !== 'resetApproval' && step.kind !== 'approve')
        return false;
      for (let attempt = 0; attempt < 15; attempt += 1) {
        if (taskSignal.aborted || !isTaskCurrent()) return false;
        try {
          const allowance = await fetchAllowance();
          if (!isTaskCurrent() || taskSignal.aborted) return false;
          if (
            step.kind === 'resetApproval'
              ? allowance.isZero()
              : allowance.gte(amountBN)
          )
            return true;
        } catch {
          // A transient read can recover after the confirmed transaction settles.
        }
        if (attempt < 14) await timerUtils.wait(2000);
      }
      return false;
    },
  };
  return runDepositTask({
    task,
    taskState,
    resume: Boolean(resumeTaskState),
    adapter,
    signal,
    isCurrent,
    onTaskReady,
    onTaskChange,
    onFail,
    formatMessage,
    recording,
    canPublishRecording: canRecoverRecording,
  });
}
