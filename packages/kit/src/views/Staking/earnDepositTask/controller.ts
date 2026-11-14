import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { createDepositTaskState, isSameDepositTaskIdentity } from './state';

import type {
  IDepositTask,
  IDepositTaskAction,
  IDepositTaskIdentity,
  IDepositTaskState,
  IDepositTaskStep,
} from './state';

type IStepContext = {
  identity: IDepositTaskIdentity;
  taskId: string;
  attemptId: string;
  step: IDepositTaskStep;
  signal: AbortSignal;
};

type IConfirmResult =
  | { type: 'submitted' }
  | { type: 'cancelled' }
  | { type: 'failed' };

export type IDepositTaskPreparation<TPrepared> =
  | { type: 'confirm'; prepared: TPrepared }
  | { type: 'skip' }
  | { type: 'insertReset'; resetStepId: string }
  | { type: 'insertApproval'; approvalStepId: string; resetStepId?: string }
  | { type: 'cancelled' };

export type IDepositTaskAdapter<TPrepared = unknown> = {
  prepare: (
    context: IStepContext & { isRetry: boolean },
  ) => Promise<IDepositTaskPreparation<TPrepared>>;
  beforeConfirm?: (context: IStepContext) => Promise<boolean>;
  confirm: (
    context: IStepContext & {
      prepared: TPrepared;
      onBeforeSend: () => void;
      onSendBlocked: () => void;
      onSubmitted: (txid: string) => boolean;
      onLateBroadcastAccepted: (txid: string) => boolean;
    },
  ) => Promise<IConfirmResult>;
  waitForFinalStatus: (
    context: IStepContext & { txid: string },
  ) => Promise<'success' | 'failed' | 'unknown'>;
  verify: (context: IStepContext & { txid: string }) => Promise<boolean>;
};

export function createDepositTaskController<TPrepared>({
  task: initialTask,
  taskState,
  adapter,
  isCurrent,
  onChange,
  onStaleChange,
  onError,
}: {
  task: IDepositTask;
  taskState?: IDepositTaskState;
  adapter: IDepositTaskAdapter<TPrepared>;
  isCurrent: () => boolean;
  onChange: (task: IDepositTask) => void;
  onStaleChange?: (task: IDepositTask) => void;
  onError?: (error: unknown) => void;
}) {
  const state = taskState ?? createDepositTaskState(initialTask);
  const currentIdentity = state.getTask().identity;
  const expectedIdentity = initialTask.identity;
  if (
    state.getTask().taskId !== initialTask.taskId ||
    !isSameDepositTaskIdentity(currentIdentity, expectedIdentity)
  ) {
    throw new OneKeyLocalError('Deposit task state identity mismatch');
  }
  const owner = Symbol('deposit-task-controller');
  let ownedAttempt: { stepId: string; attemptId: string } | undefined;
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
    action: IDepositTaskAction,
  ) => {
    const changed = state.dispatch({
      ...action,
      taskId: initialTask.taskId,
      stepId,
      attemptId,
    });
    if (changed) {
      publishChange();
      return true;
    }
    return false;
  };

  const recordLateBroadcast = (
    stepId: string,
    attemptId: string,
    txid: string,
  ) => {
    const task = state.getTask();
    const current = task.steps[task.currentStepIndex];
    const normalized = txid.trim();
    if (
      !current ||
      current.id !== stepId ||
      current.attemptId !== attemptId ||
      !normalized
    )
      return false;
    const previous =
      current.status.type === 'confirming' ||
      current.status.type === 'verifying' ||
      current.status.type === 'unknown' ||
      current.status.type === 'handedOff' ||
      current.status.type === 'succeeded'
        ? current.status.txid
        : undefined;
    if (previous) {
      if (previous !== normalized) {
        update(stepId, attemptId, { type: 'txidConflict', txid: normalized });
        return false;
      }
      return current.status.type === 'unknown' && !current.status.txidConflict;
    }
    return update(stepId, attemptId, {
      type: 'lateBroadcastAccepted',
      txid: normalized,
    });
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
    if (current?.id === stepId && current.kind === 'deposit' && normalized) {
      const event = { taskId: task.taskId, stepId, attemptId };
      if (
        !state.dispatchBatch([
          { ...event, type: 'submitted', txid: normalized },
          { ...event, type: 'handoff' },
        ])
      )
        return false;
      publishChange();
    } else if (!update(stepId, attemptId, { type: 'submitted', txid })) {
      return false;
    }
    const result = state.getTask().steps.find((step) => step.id === stepId);
    if (!normalized || result?.attemptId !== attemptId) return false;
    if (result.kind === 'deposit')
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

  const cancel = () => {
    abortController.abort();
    try {
      if (state.owns(owner) && ownedAttempt) {
        update(ownedAttempt.stepId, ownedAttempt.attemptId, { type: 'cancel' });
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
      if (step.kind === 'deposit') {
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

  const runPlan = async (retryFirstStep: boolean) => {
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
    if (!state.acquire(owner)) return;
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
          const preparation = await adapter.prepare(context);
          if (!checkCurrent()) return;
          if (preparation.type === 'cancelled') {
            update(step.id, attemptId, { type: 'cancel' });
            return;
          }
          if (
            preparation.type === 'insertReset' ||
            preparation.type === 'insertApproval'
          ) {
            if (!isRetry || !update(step.id, attemptId, preparation)) {
              update(step.id, attemptId, { type: 'fail' });
              return;
            }
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
            const confirmation = await adapter.confirm({
              ...context,
              prepared: preparation.prepared,
              onBeforeSend: () => {
                if (
                  !checkCurrent() ||
                  !update(step.id, attemptId, { type: 'sendStarted' })
                ) {
                  throw new OneKeyLocalError(
                    'Deposit task confirmation expired',
                  );
                }
                if (!checkCurrent()) {
                  update(step.id, attemptId, { type: 'sendBlocked' });
                  throw new OneKeyLocalError(
                    'Deposit task confirmation expired',
                  );
                }
              },
              onSendBlocked: () => {
                update(step.id, attemptId, { type: 'sendBlocked' });
              },
              onSubmitted: (txid) => recordSubmitted(step.id, attemptId, txid),
              onLateBroadcastAccepted: (txid) =>
                recordLateBroadcast(step.id, attemptId, txid),
            });
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
            if (completed !== 'succeeded' && completed !== 'handedOff') return;
          }
        } catch (error) {
          if (checkCurrent()) {
            update(step.id, attemptId, { type: 'fail' });
            if (checkCurrent()) onError?.(error);
          }
          return;
        }
      }
    } finally {
      running = false;
      ownedAttempt = undefined;
      state.release(owner);
    }
  };

  const retryStatus = async () => {
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
    if (!state.acquire(owner)) return;
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
      }
    } finally {
      running = false;
      ownedAttempt = undefined;
      state.release(owner);
    }
  };

  return {
    getTask: state.getTask,
    run: () => runPlan(false),
    retry: () => runPlan(true),
    cancel,
    retryStatus,
  };
}
