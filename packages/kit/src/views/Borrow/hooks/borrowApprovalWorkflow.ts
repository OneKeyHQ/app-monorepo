import type { IEarnTaskScope } from '@onekeyhq/kit/src/views/Earn/tasks/earnTaskPlan';
import { createEarnWorkflowTaskController } from '@onekeyhq/kit/src/views/Earn/tasks/earnWorkflowTaskController';
import { createEarnWorkflowTask } from '@onekeyhq/kit/src/views/Earn/tasks/earnWorkflowTaskState';
import { isTaskAccountAddress } from '@onekeyhq/kit/src/views/Earn/tasks/taskAccount';
import type {
  IEarnTransactionTaskAdapter,
  IEarnTransactionTaskPreparation,
} from '@onekeyhq/kit/src/views/Earn/tasks/transactionTaskController';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import type {
  IBorrowConfirmationPrepared,
  IBorrowWorkflowHandoff,
  IBorrowWorkflowTransactionStep,
} from './borrowConfirmationTask';

type IIdentity = IEarnTaskScope & { action: string };
type IPreparation<T> = IEarnTransactionTaskPreparation<T, never>;
type IAdapter<T> = IEarnTransactionTaskAdapter<
  IIdentity,
  IBorrowWorkflowTransactionStep,
  T,
  IPreparation<T>
>;
type IPrepared<T> =
  | { kind: 'approval'; value: T }
  | { kind: 'business'; value: IBorrowConfirmationPrepared };
type IConfirmation = Parameters<IBorrowWorkflowHandoff['register']>[1];
type IContext = { confirmation?: IConfirmation };
type IRecovery = {
  stepId?: string;
  txid?: string;
  status: 'notChecked' | 'confirmed' | 'failed';
};

function adapt<T, P>(
  adapter: IAdapter<T>,
  wrap: (value: T) => P,
  unwrap: (value: P) => T,
): IAdapter<P> {
  return {
    confirmationLifecycle: adapter.confirmationLifecycle,
    prepare: async (context) => {
      const result = await adapter.prepare(context);
      return result.type === 'confirm'
        ? { type: 'confirm', prepared: wrap(result.prepared) }
        : result;
    },
    beforeConfirm: adapter.beforeConfirm,
    confirm: (context) =>
      adapter.confirm({ ...context, prepared: unwrap(context.prepared) }),
    waitForFinalStatus: adapter.waitForFinalStatus,
    verify: adapter.verify,
  };
}

/** Owns approval and the following business transaction in one task. */
export function createBorrowApprovalWorkflow<T>({
  identity,
  approval,
  reset,
  pauseAfterReset = false,
  submit,
  isCurrent,
  onAsyncError,
}: {
  identity: IIdentity;
  approval: IAdapter<T>;
  reset?: IAdapter<T>;
  pauseAfterReset?: boolean;
  submit: (handoff: IBorrowWorkflowHandoff) => Promise<void>;
  isCurrent: () => boolean;
  onAsyncError: (error: unknown) => void;
}) {
  let acceptRegistration: (confirmation: IConfirmation) => void = () =>
    undefined;
  let registrationOpen = false;
  let registered = false;
  let businessHandedOff = false;
  let resumeReset: (() => void) | undefined;
  let resumeRequested = false;
  const registration = new Promise<IConfirmation>((resolve) => {
    acceptRegistration = resolve;
  });
  const handoff: IBorrowWorkflowHandoff = {
    register: async (businessIdentity, confirmation) => {
      if (
        !registrationOpen ||
        registered ||
        !isCurrent() ||
        businessIdentity.accountId !== identity.accountId ||
        businessIdentity.networkId !== identity.networkId ||
        businessIdentity.provider.toLowerCase() !==
          identity.provider.toLowerCase() ||
        businessIdentity.action !== identity.action ||
        !identity.accountAddress ||
        !businessIdentity.accountAddress ||
        !isTaskAccountAddress(
          {
            accountAddress: identity.accountAddress,
            networkId: identity.networkId,
          },
          businessIdentity.accountAddress,
        )
      )
        throw new OneKeyLocalError('Borrow transaction confirmation expired');
      registered = true;
      acceptRegistration(confirmation);
      const result = await confirmation.navigation;
      businessHandedOff = result === 'finished' && isCurrent();
      return businessHandedOff;
    },
  };
  const task = createEarnWorkflowTask({
    taskId: generateUUID(),
    identity,
    steps: [
      ...(reset
        ? [
            {
              id: 'reset',
              kind: 'resetApproval' as const,
              lateSubmitted: 'unknown' as const,
            },
          ]
        : []),
      ...(reset && pauseAfterReset
        ? [{ id: 'resumeApproval', kind: 'wait' as const }]
        : []),
      { id: 'approve', kind: 'approve', lateSubmitted: 'unknown' },
      { id: 'prepareBusiness', kind: 'wait' },
      { id: 'business', kind: 'protocol', lateSubmitted: 'confirming' },
    ],
  });
  const controller = createEarnWorkflowTaskController<
    IIdentity,
    IContext,
    IPrepared<T>,
    IRecovery,
    IRecovery
  >({
    task,
    initialContext: {},
    isCurrent: () => isCurrent() || businessHandedOff,
    expiredMessage: 'Borrow transaction confirmation expired',
    onAsyncError,
    facts: {
      initial: { status: 'notChecked' },
      reduce: (previous, next) =>
        previous.status === 'notChecked' ? next : previous,
    },
    getAdapter: (step, context) => {
      if (step.id === 'approve' || (step.id === 'reset' && reset))
        return {
          kind: 'transaction',
          handoffOnSubmit: false,
          adapter: adapt<T, IPrepared<T>>(
            step.id === 'reset' && reset ? reset : approval,
            (value) => ({ kind: 'approval', value }),
            (value) => {
              if (value.kind !== 'approval')
                throw new OneKeyLocalError('Invalid Borrow approval');
              return value.value;
            },
          ),
        };
      if (step.id === 'resumeApproval')
        return {
          kind: 'wait',
          run: async ({ signal, context: previous }) => {
            const resumed = await new Promise<boolean>((resolve) => {
              const onAbort = () => {
                resumeReset = undefined;
                resolve(false);
              };
              if (signal.aborted) {
                resolve(false);
                return;
              }
              if (resumeRequested) {
                resumeRequested = false;
                resolve(true);
                return;
              }
              resumeReset = () => {
                signal.removeEventListener('abort', onAbort);
                resumeReset = undefined;
                resolve(true);
              };
              signal.addEventListener('abort', onAbort, { once: true });
            });
            return resumed
              ? { type: 'completed', context: previous }
              : { type: 'cancelled' };
          },
        };
      if (step.id === 'prepareBusiness')
        return {
          kind: 'wait',
          run: async ({ signal, context: previous }) => {
            registrationOpen = true;
            let resolveAbort: () => void = () => undefined;
            const abort = new Promise<undefined>((resolve) => {
              resolveAbort = () => resolve(undefined);
              if (signal.aborted) resolve(undefined);
              else
                signal.addEventListener('abort', resolveAbort, { once: true });
            });
            try {
              const operation = submit(handoff);
              const value = await Promise.race([
                registration,
                operation.then(() => undefined),
                abort,
              ]);
              if (!value) return { type: 'cancelled' };
              void operation.catch(onAsyncError);
              return {
                type: 'completed',
                context: { ...previous, confirmation: value },
              };
            } finally {
              registrationOpen = false;
              signal.removeEventListener('abort', resolveAbort);
            }
          },
        };
      if (step.id === 'business' && context.confirmation)
        return {
          kind: 'transaction',
          handoffOnSubmit: true,
          adapter: adapt<IBorrowConfirmationPrepared, IPrepared<T>>(
            context.confirmation.adapter,
            (value) => ({ kind: 'business', value }),
            (value) => {
              if (value.kind !== 'business')
                throw new OneKeyLocalError('Invalid Borrow transaction');
              return value.value;
            },
          ),
        };
      throw new OneKeyLocalError('Invalid Borrow workflow step');
    },
  });
  return {
    ...controller,
    recordRecovery: ({
      stepId,
      attemptId,
      txid,
      status,
    }: {
      stepId: string;
      attemptId: string;
      txid: string;
      status: 'confirmed' | 'failed';
    }) => {
      const state = controller.getTask();
      const step = state.steps[state.currentStepIndex];
      if (
        step?.id !== stepId ||
        step.attemptId !== attemptId ||
        step.status.type !== 'unknown' ||
        !('txid' in step.status) ||
        step.status.txid !== txid
      )
        return false;
      return controller.recordFact({
        stepId,
        attemptId,
        fact: { stepId, txid, status },
      });
    },
    resumeApproval: () => {
      const state = controller.getTask();
      const current = state.steps[state.currentStepIndex];
      if (
        !isCurrent() ||
        current?.id !== 'resumeApproval' ||
        (current.status.type !== 'ready' && current.status.type !== 'checking')
      )
        return false;
      if (resumeReset) resumeReset();
      else resumeRequested = true;
      return true;
    },
  };
}
