import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import type {
  IEarnTransactionStepAction,
  IEarnTransactionStepStatus,
} from './transactionStep';

export type IEarnTransactionControllerStep = {
  id: string;
  kind: string;
  attemptId?: string;
  status: IEarnTransactionStepStatus;
};

export type IEarnTransactionControllerTask<
  TIdentity,
  TStep extends IEarnTransactionControllerStep,
> = {
  taskId: string;
  identity: TIdentity;
  steps: TStep[];
  currentStepIndex: number;
};

type IStepContext<TIdentity, TStep> = {
  identity: TIdentity;
  taskId: string;
  attemptId: string;
  step: TStep;
  signal: AbortSignal;
};

type IConfirmResult =
  | { type: 'submitted' }
  | { type: 'detached' }
  | { type: 'cancelled' }
  | { type: 'failed' };

export type IEarnTransactionTaskPreparation<TPrepared, TChange> =
  | { type: 'confirm'; prepared: TPrepared }
  | { type: 'skip' }
  | { type: 'change'; change: TChange }
  | { type: 'cancelled' };

export type IEarnTransactionTaskAdapter<
  TIdentity,
  TStep,
  TPrepared,
  TPreparation,
> = {
  confirmationLifecycle?: 'detached';
  prepare: (
    context: IStepContext<TIdentity, TStep> & { isRetry: boolean },
  ) => Promise<TPreparation>;
  beforeConfirm?: (context: IStepContext<TIdentity, TStep>) => Promise<boolean>;
  confirm: (
    context: IStepContext<TIdentity, TStep> & {
      prepared: TPrepared;
      onBeforeSend: () => void;
      onSendBlocked: () => void;
      onSubmitted: (txid: string) => boolean;
      onLateBroadcastAccepted: (txid: string) => boolean;
      onSendObserved: () => void;
      onConfirmationFailed: (certainty: 'beforeSend' | 'unknown') => void;
      onConfirmationCancelled: (certainty: 'beforeSend' | 'unknown') => void;
      onConfirmationSettled?: (result: 'success' | 'failed') => void;
    },
  ) => Promise<IConfirmResult>;
  waitForFinalStatus: (
    context: IStepContext<TIdentity, TStep> & { txid: string },
  ) => Promise<'success' | 'failed' | 'unknown' | 'allowanceSatisfied'>;
  verify: (
    context: IStepContext<TIdentity, TStep> & { txid: string },
  ) => Promise<boolean>;
};

type IState<TTask, TChange> = {
  getTask: () => TTask;
  dispatch: (
    stepId: string,
    attemptId: string,
    action: IEarnTransactionStepAction,
  ) => boolean;
  dispatchBatch: (
    stepId: string,
    attemptId: string,
    actions: IEarnTransactionStepAction[],
  ) => boolean;
  applyPlanChange: (
    stepId: string,
    attemptId: string,
    change: TChange,
  ) => boolean;
  acquire: (owner: symbol) => boolean;
  owns: (owner: symbol) => boolean;
  release: (owner: symbol) => void;
};

/** Orchestrates transaction lifecycle against a caller-owned task state. */
export function createEarnTransactionTaskController<
  TIdentity,
  TStep extends IEarnTransactionControllerStep,
  TTask extends IEarnTransactionControllerTask<TIdentity, TStep>,
  TPrepared,
  TChange,
  TPreparation,
>({
  state,
  adapter,
  normalizePreparation,
  shouldHandoffOnSubmit,
  isCurrent,
  onChange,
  onStaleChange,
  onError,
  onStaleError,
  expiredMessage,
  leaseOwner,
}: {
  state: IState<TTask, TChange>;
  adapter: IEarnTransactionTaskAdapter<
    TIdentity,
    TStep,
    TPrepared,
    TPreparation
  >;
  normalizePreparation: (
    preparation: TPreparation,
  ) => IEarnTransactionTaskPreparation<TPrepared, TChange>;
  shouldHandoffOnSubmit: (step: TStep) => boolean;
  isCurrent: () => boolean;
  onChange: (task: TTask) => void;
  onStaleChange?: (task: TTask) => void;
  onError?: (error: unknown) => void;
  onStaleError?: (error: unknown) => void;
  expiredMessage: string;
  leaseOwner?: symbol;
}) {
  const owner = leaseOwner ?? Symbol('earn-transaction-task-controller');
  let ownedAttempt: { stepId: string; attemptId: string } | undefined;
  let detachedAttempt: { stepId: string; attemptId: string } | undefined;
  let detachedConfirmationStarted = false;
  let running = false;
  let abortController = new AbortController();

  const publishChange = () => {
    const task = state.getTask();
    if (isCurrent() && state.owns(owner)) onChange(task);
    else onStaleChange?.(task);
  };
  const update = (
    stepId: string,
    attemptId: string,
    action: IEarnTransactionStepAction,
  ) => {
    const changed = state.dispatch(stepId, attemptId, action);
    if (changed) {
      publishChange();
      return true;
    }
    return false;
  };

  const withCallbackLease = <T>(callback: () => T): T => {
    if (
      adapter.confirmationLifecycle !== 'detached' ||
      state.owns(owner) ||
      !isCurrent() ||
      !state.acquire(owner)
    )
      return callback();
    try {
      return callback();
    } finally {
      state.release(owner);
    }
  };

  const recordSubmitted = (stepId: string, attemptId: string, txid: string) => {
    const task = state.getTask();
    const current = task.steps[task.currentStepIndex];
    const normalized = txid.trim();
    const previous =
      current?.status.type === 'confirming' ||
      current?.status.type === 'verifying' ||
      current?.status.type === 'unknown'
        ? current.status.txid
        : undefined;
    if (
      current?.id === stepId &&
      current.attemptId === attemptId &&
      previous &&
      normalized &&
      previous !== normalized
    ) {
      update(stepId, attemptId, { type: 'txidConflict', txid: normalized });
      return false;
    }
    if (
      current?.id === stepId &&
      shouldHandoffOnSubmit(current) &&
      normalized
    ) {
      if (
        !state.dispatchBatch(stepId, attemptId, [
          { type: 'submitted', txid: normalized },
          { type: 'handoff' },
        ])
      )
        return false;
      publishChange();
    } else if (!update(stepId, attemptId, { type: 'submitted', txid })) {
      return false;
    }
    const result = state.getTask().steps.find((step) => step.id === stepId);
    if (!normalized || result?.attemptId !== attemptId) return false;
    if (shouldHandoffOnSubmit(result))
      return (
        result.status.type === 'handedOff' && result.status.txid === normalized
      );
    return (
      (result.status.type === 'confirming' ||
        result.status.type === 'unknown' ||
        result.status.type === 'verifying' ||
        result.status.type === 'succeeded') &&
      result.status.txid === normalized
    );
  };

  const recordLateBroadcast = (
    stepId: string,
    attemptId: string,
    txid: string,
  ) => {
    const normalized = txid.trim();
    const task = state.getTask();
    const current = task.steps[task.currentStepIndex];
    if (
      !normalized ||
      current?.id !== stepId ||
      current.attemptId !== attemptId
    )
      return false;
    const status = current.status;
    const previous =
      status.type === 'confirming' ||
      status.type === 'verifying' ||
      status.type === 'unknown'
        ? status.txid
        : undefined;
    if (previous && previous !== normalized) {
      update(stepId, attemptId, { type: 'txidConflict', txid: normalized });
      return false;
    }
    if (status.type === 'unknown' && status.txid === normalized) return true;
    return update(stepId, attemptId, {
      type: 'lateBroadcastAccepted',
      txid: normalized,
    });
  };

  const cancel = () => {
    abortController.abort();
    try {
      const attempt = state.owns(owner) ? ownedAttempt : detachedAttempt;
      if (attempt) {
        const step = state
          .getTask()
          .steps.find((item) => item.id === attempt.stepId);
        update(attempt.stepId, attempt.attemptId, {
          type:
            adapter.confirmationLifecycle === 'detached' &&
            (detachedConfirmationStarted || attempt === detachedAttempt) &&
            (step?.status.type === 'awaitingUser' ||
              step?.status.type === 'sending')
              ? 'outcomeUnknown'
              : 'cancel',
        });
      }
    } finally {
      state.release(owner);
    }
  };

  const checkCurrent = () => {
    if (isCurrent() && !abortController.signal.aborted && state.owns(owner))
      return true;
    cancel();
    return false;
  };

  const reconcile = async (stepId: string, attemptId: string) => {
    let task = state.getTask();
    let step = task.steps[task.currentStepIndex];
    if (!step || step.id !== stepId || step.attemptId !== attemptId) return;
    let status = step.status;
    if (status.type === 'confirming') {
      if (shouldHandoffOnSubmit(step)) {
        update(stepId, attemptId, { type: 'handoff' });
        return;
      }
      const txid = status.txid;
      const result = await adapter.waitForFinalStatus({
        identity: task.identity,
        taskId: task.taskId,
        attemptId,
        step,
        signal: abortController.signal,
        txid,
      });
      if (!checkCurrent()) return;
      if (result === 'allowanceSatisfied') {
        update(stepId, attemptId, { type: 'allowanceSatisfied' });
        return;
      }
      if (result === 'failed') {
        update(stepId, attemptId, { type: 'chainFailed' });
        return;
      }
      if (result !== 'success') {
        update(stepId, attemptId, { type: 'fail' });
        return;
      }
      update(stepId, attemptId, { type: 'confirmed' });
      if (!checkCurrent()) return;
      task = state.getTask();
      step = task.steps[task.currentStepIndex];
      if (!step || step.id !== stepId || step.attemptId !== attemptId) return;
      status = step.status;
    }
    if (status.type !== 'verifying') return;
    const valid = await adapter.verify({
      identity: task.identity,
      taskId: task.taskId,
      attemptId,
      step,
      signal: abortController.signal,
      txid: status.txid,
    });
    if (!checkCurrent()) return;
    update(stepId, attemptId, { type: valid ? 'verified' : 'fail' });
  };

  const runPlan = async (retryFirstStep: boolean, borrowedLease = false) => {
    if (running || !isCurrent()) return;
    const initialSnapshot = state.getTask();
    const initialStep = initialSnapshot.steps[initialSnapshot.currentStepIndex];
    if (retryFirstStep) {
      if (
        initialStep?.status.type !== 'cancelled' &&
        initialStep?.status.type !== 'failed'
      )
        return;
    }
    if (borrowedLease ? !state.owns(owner) : !state.acquire(owner)) return;
    if (retryFirstStep) abortController = new AbortController();
    else if (!checkCurrent()) return;
    running = true;
    try {
      let retrying = retryFirstStep;
      while (checkCurrent()) {
        const task = state.getTask();
        const step = task.steps[task.currentStepIndex];
        if (!step || (!retrying && step.status.type !== 'ready')) return;
        const attemptId = generateUUID();
        const isRetry = retrying;
        ownedAttempt = { stepId: step.id, attemptId };
        if (!update(step.id, attemptId, { type: retrying ? 'retry' : 'start' }))
          return;
        if (!checkCurrent()) return;
        retrying = false;
        try {
          const startedTask = state.getTask();
          const activeStep = startedTask.steps[startedTask.currentStepIndex];
          if (
            !activeStep ||
            activeStep.id !== step.id ||
            activeStep.attemptId !== attemptId
          )
            return;
          const context = {
            identity: startedTask.identity,
            taskId: startedTask.taskId,
            attemptId,
            isRetry,
            step: activeStep,
            signal: abortController.signal,
          };
          const rawPreparation = await adapter.prepare(context);
          if (!checkCurrent()) return;
          const preparation = normalizePreparation(rawPreparation);
          if (preparation.type === 'cancelled') {
            update(step.id, attemptId, { type: 'cancel' });
            return;
          }
          if (preparation.type === 'change') {
            if (
              !isRetry ||
              !state.applyPlanChange(step.id, attemptId, preparation.change)
            ) {
              update(step.id, attemptId, { type: 'fail' });
              return;
            }
            publishChange();
          } else if (preparation.type === 'skip') {
            if (!update(step.id, attemptId, { type: 'skip' })) {
              update(step.id, attemptId, { type: 'fail' });
              return;
            }
          } else {
            const canConfirm = adapter.beforeConfirm
              ? await adapter.beforeConfirm(context)
              : true;
            if (!checkCurrent()) return;
            if (!canConfirm) {
              update(step.id, attemptId, { type: 'cancel' });
              return;
            }
            if (!update(step.id, attemptId, { type: 'confirmationOpened' }))
              return;
            if (!checkCurrent()) return;
            detachedConfirmationStarted =
              adapter.confirmationLifecycle === 'detached';
            const confirmationState = { closed: false };
            const attemptSignal = abortController.signal;
            const confirmation = await adapter.confirm({
              ...context,
              prepared: preparation.prepared,
              onBeforeSend: () => {
                if (
                  !checkCurrent() ||
                  !update(step.id, attemptId, { type: 'sendStarted' })
                ) {
                  throw new OneKeyLocalError(expiredMessage);
                }
                if (!checkCurrent()) {
                  update(step.id, attemptId, { type: 'sendBlocked' });
                  throw new OneKeyLocalError(expiredMessage);
                }
              },
              onSendBlocked: () => {
                update(step.id, attemptId, { type: 'sendBlocked' });
              },
              onSubmitted: (txid) =>
                withCallbackLease(() => {
                  if (
                    confirmationState.closed ||
                    attemptSignal.aborted ||
                    !isCurrent()
                  ) {
                    return recordLateBroadcast(step.id, attemptId, txid);
                  }
                  return recordSubmitted(step.id, attemptId, txid);
                }),
              onLateBroadcastAccepted: (txid) =>
                withCallbackLease(() =>
                  recordLateBroadcast(step.id, attemptId, txid),
                ),
              onSendObserved: () => {
                withCallbackLease(() =>
                  update(step.id, attemptId, { type: 'sendStarted' }),
                );
              },
              onConfirmationFailed: (certainty) => {
                confirmationState.closed = true;
                withCallbackLease(() => {
                  if (
                    certainty === 'beforeSend' &&
                    state.getTask().steps.find((item) => item.id === step.id)
                      ?.status.type === 'sending'
                  )
                    update(step.id, attemptId, { type: 'sendBlocked' });
                  update(step.id, attemptId, {
                    type:
                      certainty === 'beforeSend' ? 'fail' : 'outcomeUnknown',
                  });
                });
              },
              onConfirmationCancelled: (certainty) => {
                confirmationState.closed = true;
                withCallbackLease(() =>
                  update(step.id, attemptId, {
                    type:
                      certainty === 'beforeSend' ? 'cancel' : 'outcomeUnknown',
                  }),
                );
              },
            });
            if (confirmation.type === 'detached') {
              detachedAttempt = { stepId: step.id, attemptId };
              if (!checkCurrent()) return;
              return;
            }
            if (!checkCurrent()) return;
            if (confirmation.type === 'submitted') {
              const currentTask = state.getTask();
              const current = currentTask.steps[currentTask.currentStepIndex];
              if (
                current?.id === step.id &&
                (current.status.type === 'sending' ||
                  current.status.type === 'awaitingUser')
              ) {
                recordSubmitted(step.id, attemptId, '');
              }
            } else {
              update(step.id, attemptId, {
                type: confirmation.type === 'cancelled' ? 'cancel' : 'fail',
              });
            }
            if (!checkCurrent() || confirmation.type !== 'submitted') return;
            await reconcile(step.id, attemptId);
            if (!checkCurrent()) return;
            const completed = state
              .getTask()
              .steps.find((item) => item.id === step.id)?.status.type;
            if (
              completed !== 'succeeded' &&
              completed !== 'handedOff' &&
              completed !== 'allowanceSatisfied'
            )
              return;
          }
        } catch (error) {
          if (checkCurrent()) {
            update(step.id, attemptId, { type: 'fail' });
            if (checkCurrent()) onError?.(error);
          } else onStaleError?.(error);
          return;
        }
        if (borrowedLease) return;
      }
    } finally {
      running = false;
      ownedAttempt = undefined;
      detachedConfirmationStarted = false;
      if (!borrowedLease) state.release(owner);
    }
  };

  const retryStatus = async (borrowedLease = false) => {
    if (running || !isCurrent()) return;
    const task = state.getTask();
    const step = task.steps[task.currentStepIndex];
    if (!step?.attemptId) return;
    if (step.status.type === 'unknown' && !step.status.txid) return;
    if (
      step.status.type !== 'unknown' &&
      step.status.type !== 'confirming' &&
      step.status.type !== 'verifying'
    )
      return;
    if (borrowedLease ? !state.owns(owner) : !state.acquire(owner)) return;
    running = true;
    ownedAttempt = { stepId: step.id, attemptId: step.attemptId };
    try {
      abortController = new AbortController();
      if (
        step.status.type === 'unknown' &&
        !update(step.id, step.attemptId, { type: 'retryStatus' })
      )
        return;
      await reconcile(step.id, step.attemptId);
    } catch (error) {
      if (checkCurrent()) {
        update(step.id, step.attemptId, { type: 'fail' });
        if (checkCurrent()) onError?.(error);
      } else onStaleError?.(error);
    } finally {
      running = false;
      ownedAttempt = undefined;
      if (!borrowedLease) state.release(owner);
    }
  };

  return {
    getTask: state.getTask,
    run: () => runPlan(false),
    retry: () => runPlan(true),
    runStepUnderLease: () => runPlan(false, true),
    retryStepUnderLease: () => runPlan(true, true),
    cancel,
    retryStatus: () => retryStatus(),
    retryStatusUnderLease: () => retryStatus(true),
  };
}
