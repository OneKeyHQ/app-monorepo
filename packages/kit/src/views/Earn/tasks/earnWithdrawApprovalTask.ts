import { normalizeTaskAccountAddress } from '@onekeyhq/kit/src/views/Earn/tasks/taskAddress';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createEarnTaskAdapterRegistration } from './earnTaskAdapterRegistration';
import { createEarnWorkflowTaskController } from './earnWorkflowTaskController';
import { createEarnWorkflowTask } from './earnWorkflowTaskState';

import type { IEarnTaskScope } from './earnTaskPlan';
import type {
  IEarnWorkflowStepPlan,
  IEarnWorkflowTaskStep,
} from './earnWorkflowTaskState';
import type {
  IEarnTransactionTaskAdapter,
  IEarnTransactionTaskPreparation,
} from './transactionTaskController';

export type IEarnWithdrawApprovalIdentity = IEarnTaskScope & {
  action: 'withdraw';
  accountAddress: string;
};
type ITransactionStep = Exclude<
  IEarnWorkflowTaskStep,
  { kind: 'sign' | 'external' | 'wait' }
>;
type IAdapter<T> = IEarnTransactionTaskAdapter<
  IEarnWithdrawApprovalIdentity,
  ITransactionStep,
  T,
  IEarnTransactionTaskPreparation<
    T,
    import('./earnWorkflowTaskState').IEarnWorkflowPlanChange
  >
>;
type IPrepared<A, P> =
  | { kind: 'approval'; value: A }
  | { kind: 'protocol'; value: P };

export type IEarnWithdrawWorkflowAdapter<T, C> = ReturnType<
  Parameters<
    typeof createEarnWorkflowTaskController<IEarnWithdrawApprovalIdentity, C, T>
  >[0]['getAdapter']
>;

export type IEarnWithdrawProtocolFragment<P, C, TFactEvent = never> = {
  identity: IEarnWithdrawApprovalIdentity;
  steps: readonly IEarnWorkflowStepPlan[];
  getAdapter: (
    step: IEarnWorkflowTaskStep,
    context: C,
  ) => IEarnWithdrawWorkflowAdapter<P, C>;
  result: Promise<boolean>;
  observeTask?: (snapshot: {
    currentStepIndex: number;
    steps: readonly { id: string; status: { type: string } }[];
  }) => void;
  cancel?: () => void;
  onStaleTransactionError?: (error: unknown) => void;
  isExpectedCancellation?: (error: unknown) => boolean;
  hasDeliveredExternalEffect?: () => boolean;
  bindRuntime?: (runtime: {
    retained: boolean;
    recordFact: (params: {
      stepId: string;
      attemptId: string;
      fact: TFactEvent;
    }) => boolean;
  }) => void;
  detachView?: () => void;
  lifecycle?: Promise<void>;
  handlesContinuationErrors?: boolean;
};

export type IEarnWithdrawWorkflowHandoff<P, C, TFactEvent = never> = {
  register: (
    fragment: IEarnWithdrawProtocolFragment<P, C, TFactEvent>,
  ) => Promise<boolean>;
};

function adapt<A, P>(
  adapter: IAdapter<A>,
  wrap: (value: A) => P,
  unwrap: (value: P) => A,
  onError: (error: unknown) => void,
): IAdapter<P> {
  const report = async <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      onError(error);
      throw error;
    }
  };
  const beforeConfirm = adapter.beforeConfirm;
  return {
    confirmationLifecycle: adapter.confirmationLifecycle,
    prepare: (context) =>
      report(async () => {
        const preparation = await adapter.prepare(context);
        return preparation.type === 'confirm'
          ? { type: 'confirm', prepared: wrap(preparation.prepared) }
          : preparation;
      }),
    beforeConfirm: beforeConfirm
      ? (context) => report(() => beforeConfirm(context))
      : undefined,
    confirm: (context) =>
      report(() =>
        adapter.confirm({ ...context, prepared: unwrap(context.prepared) }),
      ),
    waitForFinalStatus: (context) =>
      report(() => adapter.waitForFinalStatus(context)),
    verify: (context) => report(() => adapter.verify(context)),
  };
}

function samePlan(
  left: readonly IEarnWorkflowStepPlan[],
  right: readonly IEarnWorkflowStepPlan[],
) {
  return (
    left.length === right.length &&
    left.every((step, index) => {
      const other = right[index];
      if (!other || step.id !== other.id || step.kind !== other.kind)
        return false;
      if ('lateSubmitted' in step)
        return (
          'lateSubmitted' in other && step.lateSubmitted === other.lateSubmitted
        );
      return !('lateSubmitted' in other);
    })
  );
}

function sameIdentity(
  expected: IEarnWithdrawApprovalIdentity,
  actual: IEarnWithdrawApprovalIdentity,
) {
  if (
    expected.accountId !== actual.accountId ||
    expected.networkId !== actual.networkId ||
    expected.provider.toLowerCase() !== actual.provider.toLowerCase() ||
    expected.action !== actual.action ||
    !expected.accountAddress.trim() ||
    !actual.accountAddress.trim()
  )
    return false;
  return (
    normalizeTaskAccountAddress(expected.networkId, expected.accountAddress) ===
    normalizeTaskAccountAddress(expected.networkId, actual.accountAddress)
  );
}

/** Owns approval, allowance and the registered protocol steps in one workflow. */
export function createEarnWithdrawApprovalTask<
  A,
  P,
  C,
  TFacts = undefined,
  TFactEvent = never,
>({
  taskId,
  identity,
  protocolSteps,
  initialContext,
  approval,
  allowanceCheck,
  prepareBusiness,
  isCurrent,
  isCurrentAfterHandoff,
  signal,
  onAsyncError,
  retained,
}: {
  taskId: string;
  identity: IEarnWithdrawApprovalIdentity;
  protocolSteps: readonly IEarnWorkflowStepPlan[];
  initialContext: C;
  approval: {
    adapter: IAdapter<A>;
    handoffOnSubmit: boolean;
    allowMissingTxidAllowanceCheck?: boolean;
  };
  allowanceCheck: (signal: AbortSignal) => Promise<boolean>;
  prepareBusiness: (
    handoff: IEarnWithdrawWorkflowHandoff<P, C, TFactEvent>,
  ) => Promise<void>;
  isCurrent: () => boolean;
  isCurrentAfterHandoff?: () => boolean;
  signal?: AbortSignal;
  onAsyncError: (error: unknown) => void;
  retained?: {
    facts: {
      initial: TFacts;
      reduce: (facts: TFacts, event: TFactEvent) => TFacts;
    };
  };
}) {
  if (!identity.accountAddress.trim())
    throw new OneKeyLocalError('Earn withdrawal account address is missing');
  const registration =
    createEarnTaskAdapterRegistration<
      IEarnWithdrawProtocolFragment<P, C, TFactEvent>
    >();
  let registered: IEarnWithdrawProtocolFragment<P, C, TFactEvent> | undefined;
  let fragmentCancelStarted = false;
  const cancelFragment = () => {
    if (fragmentCancelStarted) return;
    fragmentCancelStarted = true;
    registered?.cancel?.();
  };
  let registrationOpen = false;
  let completed = false;
  let failure: unknown;
  let failed = false;
  let lastAsyncError: unknown;
  let asyncErrorReported = false;
  let started = false;
  let cancelled = false;
  let businessHandedOff = false;
  let ownerDetached = false;
  let cancelController: () => void = () => undefined;
  let stopForOwnerLoss: () => void = () => undefined;
  let cleanup: () => void = () => undefined;
  let lifecycleAttached = false;
  let lifecycleSettled = false;
  const isOwnerCurrent = () =>
    businessHandedOff
      ? (isCurrentAfterHandoff?.() ?? isCurrent())
      : isCurrent();
  let resolveResult: (result: boolean) => void = () => undefined;
  let rejectResult: (error: unknown) => void = () => undefined;
  const result = new Promise<boolean>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  const finish = (value: boolean) => {
    if (completed) return;
    completed = true;
    resolveResult(value);
  };
  const fail = (error: unknown) => {
    if (completed) {
      if (
        (failed && Object.is(error, failure)) ||
        (asyncErrorReported && Object.is(error, lastAsyncError))
      )
        return;
      asyncErrorReported = true;
      lastAsyncError = error;
      onAsyncError(error);
      return;
    }
    completed = true;
    failure = error;
    failed = true;
    rejectResult(error);
    registration.cancel();
    try {
      cancelFragment();
    } catch (cancelError) {
      onAsyncError(cancelError);
    } finally {
      cancelController();
    }
  };
  const reportProtocolError = (error: unknown) => {
    if (registered?.isExpectedCancellation?.(error)) {
      stopForOwnerLoss();
      finish(false);
      return;
    }
    if (!cancelled && !signal?.aborted && isOwnerCurrent()) fail(error);
  };
  const task = createEarnWorkflowTask({
    taskId,
    identity,
    steps: [
      { id: 'approve', kind: 'approve', lateSubmitted: 'unknown' },
      { id: 'allowance', kind: 'wait' },
      { id: 'prepareBusiness', kind: 'wait' },
      ...protocolSteps,
    ],
  });
  const handoff: IEarnWithdrawWorkflowHandoff<P, C, TFactEvent> = {
    register: async (fragment) => {
      if (
        !registrationOpen ||
        !isCurrent() ||
        !sameIdentity(identity, fragment.identity) ||
        !samePlan(protocolSteps, fragment.steps) ||
        !registration.register(fragment)
      ) {
        const error = new OneKeyLocalError(
          'Invalid Earn withdrawal registration',
        );
        registration.fail(error);
        throw error;
      }
      return Promise.race([
        fragment.result.then(
          (value) =>
            value &&
            ((isCurrent() && !signal?.aborted) ||
              Boolean(fragment.hasDeliveredExternalEffect?.())),
        ),
        result.then(() => false),
      ]);
    },
  };
  const controller = createEarnWorkflowTaskController<
    IEarnWithdrawApprovalIdentity,
    C,
    IPrepared<A, P>,
    TFacts,
    TFactEvent
  >({
    task,
    initialContext,
    retained: Boolean(retained),
    facts: retained?.facts,
    isCurrent: () => !signal?.aborted && isOwnerCurrent(),
    expiredMessage: 'Earn withdrawal expired',
    onAsyncError: fail,
    continuationHandlesError: () =>
      Boolean(retained && registered?.handlesContinuationErrors),
    onStaleTransactionError: (error) => {
      registered?.onStaleTransactionError?.(error);
    },
    getAdapter: (step, context) => {
      if (step.id === 'approve')
        return {
          kind: 'transaction',
          handoffOnSubmit: approval.handoffOnSubmit,
          allowanceCheckAfterMissingTxid:
            approval.allowMissingTxidAllowanceCheck ? 'allowance' : undefined,
          adapter: {
            ...adapt<A, IPrepared<A, P>>(
              approval.adapter,
              (value) => ({ kind: 'approval', value }),
              (value) => {
                if (value.kind !== 'approval')
                  throw new OneKeyLocalError('Invalid Earn approval');
                return value.value;
              },
              fail,
            ),
            prepare: async (params) => {
              try {
                const prepared = await approval.adapter.prepare(params);
                if (prepared.type === 'skip') return { type: 'cancelled' };
                return prepared.type === 'confirm'
                  ? {
                      type: 'confirm',
                      prepared: { kind: 'approval', value: prepared.prepared },
                    }
                  : prepared;
              } catch (error) {
                fail(error);
                throw error;
              }
            },
          },
        };
      if (step.id === 'allowance')
        return {
          kind: 'wait',
          run: async ({ signal: taskSignal }) => {
            try {
              return (await allowanceCheck(taskSignal)) &&
                isCurrent() &&
                !taskSignal.aborted
                ? { type: 'completed', context }
                : { type: 'unknown' };
            } catch (error) {
              fail(error);
              throw error;
            }
          },
        };
      if (step.id === 'prepareBusiness')
        return {
          kind: 'wait',
          run: async ({ signal: taskSignal }) => {
            registrationOpen = true;
            try {
              void prepareBusiness(handoff).then(
                () => registration.cancel(),
                (error) => {
                  if (!registration.fail(error)) fail(error);
                },
              );
              const fragment = await registration.wait(taskSignal);
              if (!fragment || !isCurrent()) return { type: 'cancelled' };
              registered = fragment;
              if (retained && fragment.lifecycle) {
                lifecycleAttached = true;
                void fragment.lifecycle.then(
                  () => {
                    lifecycleSettled = true;
                    if (completed) cleanup();
                  },
                  (error: unknown) => {
                    lifecycleSettled = true;
                    onAsyncError(error);
                    if (completed) cleanup();
                  },
                );
              }
              fragment.bindRuntime?.({
                retained: Boolean(retained),
                recordFact: ({ stepId, attemptId, fact }) => {
                  if (!protocolSteps.some((planStep) => planStep.id === stepId))
                    return false;
                  return controller.recordFact({ stepId, attemptId, fact });
                },
              });
              void fragment.result.then((value) => {
                if (
                  !value ||
                  ((!isCurrent() || signal?.aborted) &&
                    !fragment.hasDeliveredExternalEffect?.())
                ) {
                  stopForOwnerLoss();
                  finish(false);
                  if (retained && ownerDetached) cleanup();
                  return;
                }
                businessHandedOff = true;
                finish(true);
              }, fail);
              return { type: 'completed', context };
            } catch (error) {
              fail(error);
              throw error;
            } finally {
              registrationOpen = false;
            }
          },
        };
      if (!registered)
        throw new OneKeyLocalError('Earn protocol not registered');
      const adapter = registered.getAdapter(step, context);
      if (adapter.kind !== 'transaction') return adapter;
      return {
        ...adapter,
        adapter: adapt<P, IPrepared<A, P>>(
          adapter.adapter,
          (value) => ({ kind: 'protocol', value }),
          (value) => {
            if (value.kind !== 'protocol')
              throw new OneKeyLocalError('Invalid Earn protocol transaction');
            return value.value;
          },
          reportProtocolError,
        ),
      };
    },
  });
  cancelController = controller.cancel;
  const ownerToken = retained
    ? controller.attachOwner(() => !signal?.aborted && isOwnerCurrent())
    : undefined;
  const detachOwner = () => {
    if (!ownerToken || ownerDetached) return;
    ownerDetached = true;
    try {
      registered?.detachView?.();
    } finally {
      controller.detachOwner(ownerToken);
    }
  };
  stopForOwnerLoss = () => {
    if (retained) detachOwner();
    else controller.cancel();
  };
  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    registration.cancel();
    try {
      if (retained) detachOwner();
      else cancelFragment();
    } catch (error) {
      fail(error);
    } finally {
      if (!retained) controller.cancel();
      if (retained || !registered?.cancel) finish(false);
      if (retained && ownerDetached && completed) cleanup();
    }
  };
  let unsubscribe: () => void = () => undefined;
  cleanup = () => {
    unsubscribe();
    signal?.removeEventListener('abort', cancel);
  };
  unsubscribe = controller.subscribe(() => {
    const state = controller.getTask();
    const step = state.steps[state.currentStepIndex];
    if (
      retained &&
      !lifecycleAttached &&
      completed &&
      (!step ||
        step.status.type === 'cancelled' ||
        step.status.type === 'failed')
    ) {
      cleanup();
      return;
    }
    if (!isOwnerCurrent() || signal?.aborted) {
      cancel();
      return;
    }
    if (!completed && registered?.observeTask) {
      try {
        registered.observeTask(state);
      } catch (error) {
        fail(error);
        return;
      }
    }
    if (
      step &&
      (step.id === 'approve' ||
        step.id === 'allowance' ||
        step.id === 'prepareBusiness') &&
      (step.status.type === 'cancelled' ||
        step.status.type === 'failed' ||
        (step.status.type === 'unknown' &&
          (step.kind === 'wait' ||
            (step.kind === 'approve' &&
              step.confirmationCallback !== 'pending'))))
    )
      finish(false);
  });
  const run = async () => {
    if (!started) {
      started = true;
      signal?.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted || !isCurrent()) cancel();
      else
        void controller.run(ownerToken).then(() => {
          const state = controller.getTask();
          const step = state.steps[state.currentStepIndex];
          if (
            !step ||
            step.status.type === 'cancelled' ||
            step.status.type === 'failed'
          )
            finish(false);
        }, fail);
    }
    try {
      return await result;
    } finally {
      const continuation = controller.getTask().signContinuation;
      if (
        !retained ||
        (ownerDetached && completed) ||
        lifecycleSettled ||
        (!lifecycleAttached &&
          continuation?.status !== 'dispatched' &&
          continuation?.status !== 'claimed')
      )
        cleanup();
    }
  };
  return {
    run,
    cancel,
    getTask: controller.getTask,
    subscribe: controller.subscribe,
  };
}
