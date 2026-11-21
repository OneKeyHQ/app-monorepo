import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getEarnProtocol } from '@onekeyhq/kit/src/views/Earn/protocols';
import {
  isTaskAccountAddress,
  isTaskAccountCurrent,
  isTaskEncodedTxOwner,
} from '@onekeyhq/kit/src/views/Earn/tasks/taskAccount';
import { normalizeTaskAccountAddress } from '@onekeyhq/kit/src/views/Earn/tasks/taskAddress';
import type {
  IApproveInfo,
  IWrappedInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IStakeBaseParams,
  IStakingInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { prepareEarnWrap } from '../../Earn/earnSwap';

import { createLateDepositOrderRecorder } from './lateDepositOrder';
import { createDepositRecording, runDepositTask } from './runDepositTask';
import { createDepositTask, isSameDepositTaskIdentity } from './state';
import { buildEarnStakeConfirmation } from './transactionBuilder';
import { waitForDepositTaskTxStatus } from './waitForDepositTaskTxStatus';

import type { IDepositTaskAdapter } from './controller';
import type { IRecordingResult } from './runDepositTask';
import type { IDepositTask, IDepositTaskState } from './state';
import type { waitForEarnTransactionConfirm } from './transactionConfirm';
import type { IDepositTaskHandle, IDirectDepositTaskConfig } from './types';

type IConfirmParams = Omit<
  Parameters<typeof waitForEarnTransactionConfirm>[0],
  'navigationToTxConfirm' | 'expiredMessage'
>;
type IPrepared =
  | {
      kind: 'stake';
      payload: Awaited<ReturnType<typeof buildEarnStakeConfirmation>>;
    }
  | { kind: 'approval'; approvesInfo: IApproveInfo[] }
  | { kind: 'wrap'; wrappedInfo: IWrappedInfo };

export async function runWrappedStakeTask({
  request,
  accountAddress,
  stakingInfo,
  inputToken,
  wrappedToken,
  spenderAddress,
  signal,
  isCurrent,
  canRecoverRecording,
  confirm,
  beforeDepositTaskSend,
  canSendDepositTask,
  prepareWrappedDeposit,
  onTaskReady,
  onTaskChange,
  onTaskSettled,
  onDepositSubmitted,
  resumeTaskState,
  onDepositSuccess,
  onFail,
  formatMessage,
}: {
  request: IStakeBaseParams;
  accountAddress: string;
  stakingInfo?: IStakingInfo;
  inputToken: IToken;
  wrappedToken: IToken;
  spenderAddress: string;
  signal: AbortSignal;
  isCurrent: () => boolean;
  canRecoverRecording?: () => boolean;
  confirm: (
    params: IConfirmParams,
  ) => ReturnType<typeof waitForEarnTransactionConfirm>;
  beforeDepositTaskSend?: (
    step: 'wrap' | 'resetApproval' | 'approve' | 'deposit',
  ) => Promise<boolean>;
  canSendDepositTask?: (
    step: 'wrap' | 'resetApproval' | 'approve' | 'deposit',
  ) => boolean;
  prepareWrappedDeposit?: IDirectDepositTaskConfig['prepareDeposit'];
  onTaskReady?: (handle: IDepositTaskHandle) => boolean | void;
  onTaskChange?: (task: IDepositTask) => void;
  onTaskSettled?: (taskId: string, txid: string) => void | Promise<void>;
  onDepositSubmitted?: (txid: string) => void;
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
  const { accountId, networkId, provider, amount } = request;
  const retryPolicy = getEarnProtocol(provider).getConfirmationRetryPolicy({
    task: 'wrapped',
    networkId,
  });
  const amountBN = new BigNumber(amount);
  const identity = {
    accountId,
    accountAddress,
    networkId,
    provider,
    vault: request.protocolVault ?? '',
    inputTokenAddress: request.inputTokenAddress ?? '',
    depositTokenAddress: wrappedToken.address,
    amount,
    spenderAddress,
    intent: {
      symbol: request.symbol,
      outputTokenAddress: request.outputTokenAddress ?? '',
      depositTokenDecimals: wrappedToken.decimals,
      term: request.term,
      validatorPublicKey: request.validatorPublicKey,
      slippage: request.slippage,
    },
  };
  const retainedTask = resumeTaskState?.getTask();
  if (
    retainedTask &&
    !isSameDepositTaskIdentity(retainedTask.identity, identity)
  ) {
    throw new OneKeyLocalError('Retained deposit task identity mismatch');
  }
  const task =
    retainedTask ??
    createDepositTask({
      taskId: generateUUID(),
      identity,
      steps: [
        { id: 'wrap', kind: 'wrap' },
        { id: 'approve', kind: 'approve' },
        { id: 'deposit', kind: 'deposit' },
      ],
    });
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
        expectedAccountAddress: task.identity.accountAddress,
        spenderAddress,
        tokenAddress: wrappedToken.address,
      });
    const value = new BigNumber(response.allowanceParsed);
    if (!value.isFinite() || value.isNegative())
      throw new OneKeyLocalError('Invalid wrapped token allowance');
    return value;
  };
  const verifyWrappedBalance = async () => {
    const details = await backgroundApiProxy.serviceToken.fetchTokensDetails({
      accountId,
      networkId,
      expectedAccountAddress: task.identity.accountAddress,
      contractList: [wrappedToken.address],
    });
    const matching = details.filter(
      ({ info }) =>
        !info.isNative &&
        normalizeTaskAccountAddress(networkId, info.address) ===
          normalizeTaskAccountAddress(networkId, wrappedToken.address),
    );
    const item = matching[0];
    if (
      matching.length !== 1 ||
      !item ||
      item.info.decimals !== wrappedToken.decimals ||
      (item.info.networkId && item.info.networkId !== networkId) ||
      typeof item.balanceParsed !== 'string' ||
      !item.balanceParsed.trim()
    ) {
      throw new OneKeyLocalError('Invalid wrapped token balance');
    }
    const balance = new BigNumber(item.balanceParsed);
    if (!balance.isFinite() || balance.isNegative() || balance.lt(amountBN)) {
      throw new OneKeyLocalError('Insufficient wrapped token balance');
    }
  };
  const adapter: IDepositTaskAdapter<IPrepared> = {
    prepare: async ({ step, isRetry, signal: taskSignal }) => {
      if (!isTaskCurrent() || taskSignal.aborted) return { type: 'cancelled' };
      if (step.kind === 'wrap') {
        return {
          type: 'confirm',
          prepared: {
            kind: 'wrap',
            wrappedInfo: await prepareEarnWrap({
              accountId,
              networkId,
              accountAddress: task.identity.accountAddress,
              inputToken,
              wrappedToken,
              amount,
              signal: taskSignal,
            }),
          },
        };
      }
      if (step.kind === 'approve') {
        await verifyWrappedBalance();
        if (!isTaskCurrent() || taskSignal.aborted)
          return { type: 'cancelled' };
        const allowance = await fetchAllowance();
        if (!isTaskCurrent() || taskSignal.aborted)
          return { type: 'cancelled' };
        const needed = allowance.lt(amountBN);
        await timerUtils.wait(150);
        if (!isTaskCurrent() || taskSignal.aborted)
          return { type: 'cancelled' };
        if (!needed) return { type: 'skip' };
        const account = await backgroundApiProxy.serviceAccount.getAccount({
          accountId,
          networkId,
        });
        if (!isTaskCurrent() || taskSignal.aborted)
          return { type: 'cancelled' };
        if (!isTaskAccountAddress(task.identity, account.address)) {
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
                amount,
                tokenInfo: wrappedToken,
              },
            ],
          },
        };
      }
      if (step.kind === 'deposit') {
        await verifyWrappedBalance();
        if (!isTaskCurrent() || taskSignal.aborted)
          return { type: 'cancelled' };
        if (isRetry) {
          const allowance = await fetchAllowance();
          if (!isTaskCurrent() || taskSignal.aborted)
            return { type: 'cancelled' };
          if (allowance.lt(amountBN)) {
            return {
              type: 'insertApproval',
              approvalStepId: `approve:${generateUUID()}`,
            };
          }
        }
        const preparation = await prepareWrappedDeposit?.(taskSignal);
        if (
          taskSignal.aborted ||
          !isTaskCurrent() ||
          preparation?.type === 'cancelled'
        )
          return { type: 'cancelled' };
        const postWrapInfo = stakingInfo
          ? {
              ...stakingInfo,
              send: stakingInfo.send
                ? { ...stakingInfo.send, token: wrappedToken }
                : undefined,
            }
          : undefined;
        return {
          type: 'confirm',
          prepared: {
            kind: 'stake',
            payload: await buildEarnStakeConfirmation({
              request: {
                ...request,
                expectedAccountAddress: identity.accountAddress,
                stakeType: 'normal',
                inputTokenAddress: wrappedToken.address,
                effectiveApy: preparation?.effectiveApy ?? request.effectiveApy,
              },
              stakingInfo: postWrapInfo,
            }),
          },
        };
      }
      throw new OneKeyLocalError('Unsupported wrapped stake task step');
    },
    beforeConfirm: async ({ step }) => {
      if (
        step.kind !== 'wrap' &&
        step.kind !== 'approve' &&
        step.kind !== 'deposit'
      )
        return false;
      return beforeDepositTaskSend ? beforeDepositTaskSend(step.kind) : true;
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
      const payload = prepared.kind === 'stake' ? prepared.payload : undefined;
      if (payload && !isTaskEncodedTxOwner(task.identity, payload.encodedTx)) {
        throw new OneKeyLocalError('Task transaction account mismatch');
      }
      let depositReported = false;
      let recordPromise: Promise<void> | undefined;
      const result = await confirm({
        encodedTx: payload?.encodedTx,
        wrappedInfo:
          prepared.kind === 'wrap' ? prepared.wrappedInfo : undefined,
        stakingInfo: payload?.stakeInfoWithOrderId,
        useFeeInTx: payload?.useFeeInTx,
        feeInfoEditable: payload?.feeInfoEditable,
        approvesInfo:
          prepared.kind === 'approval' ? prepared.approvesInfo : undefined,
        allowDeviceRejectionRetry: retryPolicy.allowDeviceRejectionRetry,
        allowManualResubmission: retryPolicy.allowManualResubmission,
        isNavigationCurrent: isCurrent,
        signal: taskSignal,
        beforeSendGuard: async () => {
          if (
            (step.kind !== 'wrap' &&
              step.kind !== 'approve' &&
              step.kind !== 'deposit') ||
            (beforeDepositTaskSend && !(await beforeDepositTaskSend(step.kind)))
          ) {
            throw new OneKeyLocalError(
              formatMessage(ETranslations.privacy_error_review_expired__msg),
            );
          }
          if (step.kind === 'deposit') {
            const allowance = await fetchAllowance();
            if (!isTaskCurrent() || taskSignal.aborted) {
              throw new OneKeyLocalError(
                formatMessage(ETranslations.privacy_error_review_expired__msg),
              );
            }
            if (allowance.lt(amountBN)) {
              throw new OneKeyLocalError(
                'Token allowance changed before deposit',
              );
            }
          }
          if (step.kind !== 'wrap') {
            await verifyWrappedBalance();
            if (!isTaskCurrent() || taskSignal.aborted) {
              throw new OneKeyLocalError(
                formatMessage(ETranslations.privacy_error_review_expired__msg),
              );
            }
          }
          if (
            !(await isTaskAccountCurrent(task.identity)) ||
            !isTaskCurrent() ||
            taskSignal.aborted
          ) {
            throw new OneKeyLocalError(
              formatMessage(ETranslations.privacy_error_review_expired__msg),
            );
          }
        },
        canSendNow: canSendDepositTask
          ? () => canSendDepositTask(step.kind)
          : undefined,
        onSendStarted: onBeforeSend,
        onSendBlocked,
        onLateBroadcastAccepted: async (fact) => {
          if (
            fact.accountId !== task.identity.accountId ||
            fact.networkId !== task.identity.networkId ||
            !fact.uuid.trim() ||
            !onLateBroadcastAccepted(fact.txid)
          )
            return;
          if (step.kind === 'deposit' && !depositReported) {
            depositReported = true;
            onDepositSubmitted?.(fact.txid);
            recordPromise = recording.start(
              fact.txid,
              () =>
                recordLateOrder({
                  fact,
                  accountId: task.identity.accountId,
                  networkId: task.identity.networkId,
                  stakeInfo: payload?.stakeInfoWithOrderId,
                }),
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
          if (step.kind === 'deposit' && txid && accepted && !depositReported) {
            depositReported = true;
            onDepositSubmitted?.(txid);
            recordPromise = recording.start(
              txid,
              () =>
                onDepositSuccess(data, payload?.stakeInfoWithOrderId, {
                  lateAfterSettlement: Boolean(options?.lateAfterSettlement),
                  isRecordingCurrent: recording.isActive,
                }),
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
    waitForFinalStatus: async ({ step, txid, signal: taskSignal }) => {
      const status = await waitForDepositTaskTxStatus({
        identity: task.identity,
        txid,
        signal: taskSignal,
      });
      if (status === 'success') {
        if (step.kind === 'approve') await timerUtils.wait(150);
        return 'success';
      }
      if (status === 'failed') {
        return 'failed';
      }
      return 'unknown';
    },
    verify: async ({ step, signal: taskSignal }) => {
      if (!isTaskCurrent() || taskSignal.aborted) return false;
      if (step.kind === 'wrap') {
        return true;
      }
      if (step.kind !== 'approve') return false;
      for (let attempt = 0; attempt < 15; attempt += 1) {
        if (taskSignal.aborted || !isCurrent()) return false;
        try {
          const allowance = await fetchAllowance();
          if (!isTaskCurrent() || taskSignal.aborted) return false;
          if (allowance.gte(amountBN)) {
            return true;
          }
        } catch {
          // A transient allowance read can recover while the confirmed approval settles.
        }
        if (attempt < 14) await timerUtils.wait(2000);
      }
      return false;
    },
  };
  return runDepositTask({
    task,
    taskState: resumeTaskState,
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
