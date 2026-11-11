import type { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IStakeTxResponse,
  IStakingInfo,
} from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import {
  createEarnConfirmationLifecycle,
  createEarnConfirmationTaskAdapter,
} from '../../tasks/confirmationTaskAdapter';
import { createEarnWorkflowTaskController } from '../../tasks/earnWorkflowTaskController';
import { createEarnWorkflowTask } from '../../tasks/earnWorkflowTaskState';
import { createLateEarnOrderRecorder } from '../../tasks/lateEarnOrderRecorder';

import { stakefishWithdrawSteps } from './withdrawPlan';

import type { IEarnTaskScope } from '../../tasks/earnTaskPlan';
import type { IEarnWorkflowTaskStep } from '../../tasks/earnWorkflowTaskState';
import type { IEarnWithdrawTransaction } from '../withdrawProtocol';

type ITransactionStep = Exclude<
  IEarnWorkflowTaskStep,
  { kind: 'sign' | 'external' | 'wait' }
>;
export type IStakefishWithdrawPrepared = IEarnWithdrawTransaction;
export type IStakefishWithdrawContext = {
  transaction?: IStakeTxResponse;
  exited?: boolean;
  signedWithdrawal?: IStakefishWithdrawSignature;
};
export type IStakefishWithdrawSignature = {
  signature: string;
  message: string;
};
type INavigate = ReturnType<
  typeof useSignatureConfirm
>['navigationToTxConfirm'];

const pendingExternalRequests = new Set<string>();

type IStakefishWithdrawParams<TIdentity extends IEarnTaskScope> = {
  identity: TIdentity;
  ownerKey: string;
  signWithdrawal?: () => Promise<IStakefishWithdrawSignature | undefined>;
  build: (signed?: IStakefishWithdrawSignature) => Promise<IStakeTxResponse>;
  isExitBroadcast: (tx: IStakeTxResponse) => boolean;
  prepare: (tx: IStakeTxResponse) => Promise<IStakefishWithdrawPrepared>;
  navigate: INavigate;
  isActionCurrent?: () => boolean;
  isSendCurrent?: () => boolean;
  isAccountCurrent?: () => Promise<boolean>;
  signal?: AbortSignal;
  onExit: () => void;
  onSubmitted: (
    data: ISendTxOnSuccessData[],
    stakeInfo?: IStakingInfo,
    options?: { isConfirmationClosed: boolean },
  ) => Promise<void>;
  onFail?: (error: Error) => void;
  onObserverError: (error: unknown) => void;
  expiredMessage: string;
  inFlightMessage: string;
};

/** Supplies protocol steps to a caller-owned controller. */
export function createStakefishWithdrawFragment<
  TIdentity extends IEarnTaskScope,
>({
  identity,
  ownerKey,
  signWithdrawal,
  build,
  isExitBroadcast,
  prepare,
  navigate,
  isActionCurrent,
  isSendCurrent,
  isAccountCurrent,
  signal,
  onExit,
  onSubmitted,
  onFail,
  onObserverError,
  expiredMessage,
  inFlightMessage,
}: IStakefishWithdrawParams<TIdentity>) {
  let cancelled = false;
  let settled = false;
  let reportingExit = false;
  let exitReported = false;
  let externalInFlight = false;
  let preparationInFlight = false;
  let pageAborted = false;
  const actionExpired = new OneKeyLocalError(expiredMessage);
  let resolveResult: (value: boolean) => void = () => undefined;
  let rejectResult: (error: unknown) => void = () => undefined;
  const result = new Promise<boolean>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  const finish = (value: boolean) => {
    if (settled) return;
    settled = true;
    resolveResult(value);
  };
  const fail = (error: unknown) => {
    if (settled) return;
    settled = true;
    rejectResult(error);
  };
  const current = () =>
    !cancelled && !signal?.aborted && (isActionCurrent?.() ?? true);
  const recordLateOrder = createLateEarnOrderRecorder();
  const getAdapter: Parameters<
    typeof createEarnWorkflowTaskController<
      TIdentity,
      IStakefishWithdrawContext,
      IStakefishWithdrawPrepared
    >
  >[0]['getAdapter'] = (step, context) => {
    if (step.id === 'signWithdrawal' && step.kind === 'sign') {
      return {
        kind: 'sign',
        run: async ({ context: previous }) => {
          if (!signWithdrawal) return { type: 'skipped', context: previous };
          if (!current() || pageAborted) return { type: 'cancelled' };
          try {
            const signedWithdrawal = await signWithdrawal();
            if (!signedWithdrawal || !current() || pageAborted) {
              finish(false);
              return { type: 'cancelled' };
            }
            return {
              type: 'completed',
              context: { ...previous, signedWithdrawal },
            };
          } catch (error) {
            fail(error);
            throw error;
          }
        },
      };
    }
    if (step.id === 'build' && step.kind === 'external') {
      return {
        kind: 'external',
        prepare: async ({ context: previous }) => previous,
        execute: async ({ context: previous }) => {
          try {
            if (pendingExternalRequests.has(ownerKey)) {
              throw new OneKeyLocalError(inFlightMessage);
            }
            pendingExternalRequests.add(ownerKey);
            externalInFlight = true;
            try {
              const transaction = await build(previous.signedWithdrawal);
              const exited = isExitBroadcast(transaction);
              if (cancelled || pageAborted) finish(false);
              return {
                type: 'completed',
                context: { ...previous, transaction, exited },
              };
            } finally {
              externalInFlight = false;
              pendingExternalRequests.delete(ownerKey);
            }
          } catch (error) {
            fail(error);
            throw error;
          }
        },
      };
    }
    if (step.id !== 'withdraw' || step.kind !== 'protocol') {
      throw new OneKeyLocalError('Invalid Stakefish withdrawal step');
    }
    const confirmationLifetime = createEarnConfirmationLifecycle();
    const confirmation = createEarnConfirmationTaskAdapter<
      TIdentity,
      ITransactionStep,
      IStakefishWithdrawPrepared,
      ISendTxOnSuccessData[],
      Error
    >({
      prepare: async () => {
        if (!current() || pageAborted) throw actionExpired;
        if (!context.transaction)
          throw new OneKeyLocalError('Withdrawal transaction is missing');
        preparationInFlight = true;
        try {
          return await prepare(context.transaction);
        } catch (error) {
          fail(error);
          throw error;
        } finally {
          preparationInFlight = false;
          if (pageAborted) finish(false);
        }
      },
      navigate: async (prepared, callbacks) => {
        await navigate({
          encodedTx: prepared.encodedTx,
          stakingInfo: prepared.stakeInfo,
          useFeeInTx: prepared.useFeeInTx,
          feeInfoEditable: prepared.feeInfoEditable,
          isNavigationCurrent: current,
          onBeforeSend: () =>
            confirmationLifetime.beforeSend(async () => {
              if (
                confirmationLifetime.isClosed() ||
                !(isSendCurrent?.() ?? true)
              )
                throw new OneKeyLocalError(expiredMessage);
              if (isAccountCurrent && !(await isAccountCurrent()))
                throw new OneKeyLocalError(expiredMessage);
              if (
                confirmationLifetime.isClosed() ||
                !(isSendCurrent?.() ?? true)
              )
                throw new OneKeyLocalError(expiredMessage);
              callbacks.onSendObserved();
            }),
          onSafePreSendFail: (error) => onFail?.(error),
          onSuccess: callbacks.onSuccess,
          onLateBroadcastAccepted: async (fact) => {
            if (
              fact.accountId !== identity.accountId ||
              fact.networkId !== identity.networkId ||
              !fact.uuid.trim() ||
              !callbacks.onLateBroadcastAccepted(fact.txid)
            )
              return;
            const recorded = await recordLateOrder({
              fact,
              accountId: identity.accountId,
              networkId: identity.networkId,
              stakeInfo: prepared.stakeInfo,
            });
            if (
              recorded !== 'synced' &&
              recorded !== 'notTracked' &&
              recorded !== 'superseded'
            )
              onObserverError(
                new OneKeyLocalError('Unable to record late Earn order'),
              );
          },
          onFail: onFail
            ? (error) => {
                confirmationLifetime.close();
                callbacks.onFail(error);
              }
            : undefined,
          onConfirmationFail: (error) => {
            confirmationLifetime.close();
            callbacks.onFail(error);
          },
          onCancel: () => {
            confirmationLifetime.close();
            callbacks.onCancel();
          },
        });
      },
      onSuccess: (data, prepared) =>
        onSubmitted(data, prepared.stakeInfo, {
          isConfirmationClosed: confirmationLifetime.isClosed(),
        }),
      onFail: onFail ? (error) => onFail(error) : undefined,
      onObserverError,
      getTxid: (data) => {
        const transaction = data[data.length - 1];
        return transaction?.signedTx?.txid || transaction?.decodedTx?.txid;
      },
      failureCertainty: () => 'unknown',
      cancellationCertainty: () => 'unknown',
    });
    void confirmation.navigation.then(
      (outcome) => finish(outcome === 'finished' && current()),
      fail,
    );
    return {
      kind: 'transaction',
      handoffOnSubmit: true,
      adapter: context.exited
        ? { ...confirmation.adapter, prepare: async () => ({ type: 'skip' }) }
        : confirmation.adapter,
    };
  };
  return {
    steps: stakefishWithdrawSteps,
    initialContext: {},
    getAdapter,
    result,
    // The owner must call this after committed task changes to report an exit.
    observeTask: (snapshot: {
      steps: readonly { id: string; status: { type: string } }[];
      currentStepIndex: number;
    }) => {
      const buildStep = snapshot.steps.find((step) => step.id === 'build');
      const withdrawStep = snapshot.steps.find(
        (step) => step.id === 'withdraw',
      );
      if (
        settled ||
        buildStep?.status.type !== 'completed' ||
        withdrawStep?.status.type !== 'skipped'
      )
        return;
      if (!current()) {
        finish(false);
        return;
      }
      reportingExit = true;
      exitReported = true;
      try {
        onExit();
        finish(true);
      } catch (error) {
        fail(error);
      } finally {
        reportingExit = false;
      }
    },
    hasReportedExit: () => exitReported,
    // Notification begins only after the skip commits for a current owner.
    // A late external result may be recorded without notifying its old owner.
    hasDeliveredExternalEffect: () => exitReported,
    onStaleTransactionError: (error: unknown) => {
      if (error !== actionExpired) throw error;
    },
    isExpectedCancellation: (error: unknown) => error === actionExpired,
    abortPage: () => {
      pageAborted = true;
      if (!reportingExit && !externalInFlight && !preparationInFlight)
        finish(false);
    },
    cancel: () => {
      cancelled = true;
      if (!reportingExit && !externalInFlight) finish(false);
    },
  };
}

export async function runStakefishWithdrawTask<
  TIdentity extends IEarnTaskScope,
>({
  taskId,
  ...params
}: IStakefishWithdrawParams<TIdentity> & { taskId: string }) {
  const current = () =>
    !params.signal?.aborted && (params.isActionCurrent?.() ?? true);
  if (!current()) return false;
  const fragment = createStakefishWithdrawFragment(params);
  const outcome = fragment.result.then(
    (value) => ({ type: 'resolved' as const, value }),
    (error: unknown) => ({ type: 'rejected' as const, error }),
  );
  const task = createEarnWorkflowTask({
    taskId,
    identity: params.identity,
    steps: fragment.steps,
  });
  const controller = createEarnWorkflowTaskController<
    TIdentity,
    IStakefishWithdrawContext,
    IStakefishWithdrawPrepared
  >({
    task,
    initialContext: fragment.initialContext,
    isCurrent: current,
    expiredMessage: params.expiredMessage,
    onAsyncError: params.onObserverError,
    onStaleTransactionError: fragment.onStaleTransactionError,
    getAdapter: fragment.getAdapter,
  });
  const abort = () => {
    controller.cancel();
    fragment.cancel();
  };
  const unsubscribe = controller.subscribe(() => {
    fragment.observeTask(controller.getTask());
  });
  params.signal?.addEventListener('abort', abort, { once: true });
  try {
    if (params.signal?.aborted) abort();
    else await controller.run();
    if (!current() && !fragment.hasReportedExit()) {
      fragment.cancel();
      return false;
    }
    const resolved = await outcome;
    if (resolved.type === 'rejected') throw resolved.error;
    return resolved.value && (fragment.hasReportedExit() || current());
  } finally {
    unsubscribe();
    params.signal?.removeEventListener('abort', abort);
  }
}
