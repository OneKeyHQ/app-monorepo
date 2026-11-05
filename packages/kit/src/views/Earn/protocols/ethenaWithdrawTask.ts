import type { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { createEarnConfirmationTaskAdapter } from '../tasks/confirmationTaskAdapter';
import { createEarnWorkflowTaskController } from '../tasks/earnWorkflowTaskController';
import { createEarnWorkflowTask } from '../tasks/earnWorkflowTaskState';
import { createLateEarnOrderRecorder } from '../tasks/lateEarnOrderRecorder';

import { getEthenaWithdrawSteps } from './ethenaWithdrawPlan';

import type { IEarnWithdrawTransaction } from './withdrawProtocol';
import type { IEarnTaskScope } from '../tasks/earnTaskPlan';
import type { IEarnWorkflowTaskStep } from '../tasks/earnWorkflowTaskState';

type ITransactionStep = Exclude<
  IEarnWorkflowTaskStep,
  { kind: 'sign' | 'external' | 'wait' }
>;
type IPrepared = IEarnWithdrawTransaction;
type IStage = 'swap' | 'unstake';
export type IEthenaWithdrawContext = { swapTxid?: string };
type IContext = IEthenaWithdrawContext;
type INavigate = ReturnType<
  typeof useSignatureConfirm
>['navigationToTxConfirm'];

export function createEthenaWithdrawAdapters<TIdentity extends IEarnTaskScope>({
  identity,
  signal,
  prepare,
  navigate,
  isActionCurrent,
  isSendCurrent,
  verifyBeforeSend,
  isExpectedCancellation,
  onSubmitted,
  waitForSwap,
  onMissingSwapTxid,
  onUnknownSwap,
  onSwapSend,
  onFail,
  onObserverError,
  resolveResult,
  rejectResult,
}: Omit<IEthenaWithdrawTaskParams<TIdentity>, 'taskId' | 'resumeUnstake'> & {
  resolveResult: (result: boolean) => void;
  rejectResult: (error: unknown) => void;
}) {
  const recordLateOrder = createLateEarnOrderRecorder();
  const getAdapter: Parameters<
    typeof createEarnWorkflowTaskController<TIdentity, IContext, IPrepared>
  >[0]['getAdapter'] = (step) => {
    if (step.id === 'settlement' && step.kind === 'wait') {
      return {
        kind: 'wait',
        run: async ({ context }) => {
          if (!context.swapTxid)
            throw new OneKeyLocalError('Swap transaction is missing');
          if (!(await waitForSwap(context.swapTxid))) {
            resolveResult(false);
            return { type: 'unknown' };
          }
          return { type: 'completed', context };
        },
      };
    }
    if (
      (step.id !== 'swap' || step.kind !== 'swap') &&
      (step.id !== 'unstake' || step.kind !== 'protocol')
    ) {
      throw new OneKeyLocalError('Invalid Ethena withdrawal step');
    }
    const stage: IStage = step.id === 'swap' ? 'swap' : 'unstake';
    let sendObserved = false;
    const confirmation = createEarnConfirmationTaskAdapter<
      typeof identity,
      ITransactionStep,
      IPrepared,
      ISendTxOnSuccessData[],
      Error
    >({
      prepare: async () => prepare(stage),
      navigate: async (prepared, callbacks) => {
        let callbackStarted = false;
        try {
          await navigate({
            encodedTx: prepared.encodedTx,
            stakingInfo: prepared.stakeInfo,
            isNavigationCurrent: () =>
              !signal?.aborted && (isActionCurrent?.() ?? true),
            onBeforeSend: verifyBeforeSend
              ? async () => {
                  if (signal?.aborted || (isSendCurrent && !isSendCurrent()))
                    throw new OneKeyLocalError('Earn withdrawal expired');
                  await verifyBeforeSend();
                  if (signal?.aborted || (isSendCurrent && !isSendCurrent()))
                    throw new OneKeyLocalError('Earn withdrawal expired');
                  if (stage === 'swap' && !sendObserved) onSwapSend();
                  sendObserved = true;
                  callbacks.onSendObserved();
                }
              : () => {
                  if (signal?.aborted || (isSendCurrent && !isSendCurrent()))
                    throw new OneKeyLocalError('Earn withdrawal expired');
                  if (stage === 'swap' && !sendObserved) onSwapSend();
                  sendObserved = true;
                  callbacks.onSendObserved();
                },
            onSafePreSendFail: verifyBeforeSend
              ? (error) => onFail?.(error)
              : undefined,
            onSuccess: (data) => {
              callbackStarted = true;
              return callbacks.onSuccess(data);
            },
            onLateBroadcastAccepted: async (fact) => {
              if (
                fact.accountId !== identity.accountId ||
                fact.networkId !== identity.networkId ||
                !fact.uuid.trim() ||
                !callbacks.onLateBroadcastAccepted(fact.txid)
              )
                return;
              if (stage === 'swap') onUnknownSwap();
              const recordingResult = await recordLateOrder({
                fact,
                accountId: identity.accountId,
                networkId: identity.networkId,
                stakeInfo: prepared.stakeInfo,
              });
              if (
                recordingResult !== 'synced' &&
                recordingResult !== 'notTracked' &&
                recordingResult !== 'superseded'
              ) {
                onObserverError(
                  new OneKeyLocalError('Unable to record late Earn order'),
                );
              }
            },
            onFail: (error) => {
              if (callbackStarted) return;
              callbackStarted = true;
              callbacks.onFail(error);
            },
            onConfirmationFail: (error) => {
              if (callbackStarted) return;
              callbackStarted = true;
              callbacks.onFail(error);
            },
            onCancel: () => {
              if (callbackStarted) return;
              callbackStarted = true;
              callbacks.onCancel();
            },
          });
        } catch (error) {
          if (!callbackStarted) callbacks.onFail(error as Error);
        }
      },
      onSuccess: async (data, prepared) => {
        try {
          await onSubmitted(stage, data, prepared.stakeInfo);
          if (stage === 'unstake') resolveResult(true);
          else if (
            !(
              data[0]?.signedTx?.txid?.trim() ||
              data[0]?.decodedTx?.txid?.trim()
            )
          ) {
            onMissingSwapTxid();
            resolveResult(true);
          }
        } catch (error) {
          rejectResult(error);
          throw error;
        }
      },
      onFail: (error) => {
        if (stage === 'swap' && sendObserved) onUnknownSwap();
        try {
          onFail?.(error);
        } catch (callbackError) {
          rejectResult(callbackError);
          return;
        }
        resolveResult(stage === 'unstake');
      },
      onCancel: () => {
        if (stage === 'swap' && sendObserved) onUnknownSwap();
        resolveResult(stage === 'unstake');
      },
      onObserverError,
      getTxid: (data) =>
        data[0]?.signedTx?.txid?.trim() || data[0]?.decodedTx?.txid?.trim(),
      failureCertainty: () => 'unknown',
      cancellationCertainty: () => 'unknown',
    });
    void confirmation.navigation.catch((error: unknown) => {
      if (isExpectedCancellation?.(error)) resolveResult(false);
      else rejectResult(error);
    });
    return {
      kind: 'transaction',
      adapter: confirmation.adapter,
      handoffOnSubmit: true,
      submittedContext: (context, txid) => ({ ...context, swapTxid: txid }),
    };
  };
  return getAdapter;
}

type IEthenaWithdrawTaskParams<TIdentity extends IEarnTaskScope> = {
  taskId: string;
  identity: TIdentity;
  resumeUnstake: boolean;
  signal?: AbortSignal;
  prepare: (stage: IStage) => Promise<IPrepared>;
  navigate: INavigate;
  isActionCurrent?: () => boolean;
  isSendCurrent?: () => boolean;
  verifyBeforeSend?: () => Promise<void>;
  isExpectedCancellation?: (error: unknown) => boolean;
  onSubmitted: (
    stage: IStage,
    data: ISendTxOnSuccessData[],
    stakeInfo?: IStakingInfo,
  ) => Promise<void>;
  waitForSwap: (txid: string) => Promise<boolean>;
  onMissingSwapTxid: () => void;
  onUnknownSwap: () => void;
  onSwapSend: () => void;
  onFail?: (error: Error) => void;
  onObserverError: (error: unknown) => void;
};

/** Builds the Pendle cooldown steps without owning a workflow controller. */
export function createEthenaWithdrawFragment<TIdentity extends IEarnTaskScope>({
  identity,
  resumeUnstake,
  signal,
  prepare,
  navigate,
  isActionCurrent,
  isSendCurrent,
  verifyBeforeSend,
  isExpectedCancellation,
  onSubmitted,
  waitForSwap,
  onMissingSwapTxid,
  onUnknownSwap,
  onSwapSend,
  onFail,
  onObserverError,
}: Omit<IEthenaWithdrawTaskParams<TIdentity>, 'taskId'>) {
  let resolveResult: (result: boolean) => void = () => undefined;
  let rejectResult: (error: unknown) => void = () => undefined;
  const result = new Promise<boolean>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  const getAdapter = createEthenaWithdrawAdapters({
    identity,
    signal,
    prepare,
    navigate,
    isActionCurrent,
    isSendCurrent,
    verifyBeforeSend,
    isExpectedCancellation,
    onSubmitted,
    waitForSwap,
    onMissingSwapTxid,
    onUnknownSwap,
    onSwapSend,
    onFail,
    onObserverError,
    resolveResult,
    rejectResult,
  });
  return {
    identity,
    steps: getEthenaWithdrawSteps(resumeUnstake),
    getAdapter,
    result,
    cancel: () => resolveResult(false),
    fail: rejectResult,
  };
}

/** The provider supplies the existing protocol-specific build and settlement operations. */
export async function runEthenaWithdrawTask<TIdentity extends IEarnTaskScope>({
  taskId,
  ...params
}: IEthenaWithdrawTaskParams<TIdentity>) {
  const { identity, signal, isActionCurrent } = params;
  const fragment = createEthenaWithdrawFragment(params);
  const task = createEarnWorkflowTask({
    taskId,
    identity,
    steps: fragment.steps,
  });
  const controller = createEarnWorkflowTaskController<
    typeof identity,
    IContext,
    IPrepared
  >({
    task,
    initialContext: {},
    isCurrent: () => !signal?.aborted && (isActionCurrent?.() ?? true),
    expiredMessage: 'Earn withdrawal expired',
    onAsyncError: fragment.fail,
    getAdapter: fragment.getAdapter,
  });
  const abort = () => {
    controller.cancel();
    fragment.cancel();
  };
  const unsubscribe = controller.subscribe(() => {
    if (!(isActionCurrent?.() ?? true)) fragment.cancel();
  });
  signal?.addEventListener('abort', abort, { once: true });
  try {
    if (signal?.aborted) abort();
    else {
      void controller.run().then(() => {
        const snapshot = controller.getTask();
        const step = snapshot.steps[snapshot.currentStepIndex];
        if (
          !(isActionCurrent?.() ?? true) ||
          !step ||
          step.status.type === 'cancelled' ||
          step.status.type === 'failed'
        ) {
          fragment.cancel();
        }
      }, fragment.fail);
    }
    return await fragment.result;
  } finally {
    unsubscribe();
    signal?.removeEventListener('abort', abort);
  }
}
