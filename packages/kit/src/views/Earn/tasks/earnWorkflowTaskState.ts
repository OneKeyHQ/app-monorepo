import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { getEarnTaskStepIdentityError } from './earnTaskPlan';
import { reduceEarnTransactionStep } from './transactionStep';

import type {
  IEarnTask,
  IEarnTaskScope,
  IEarnTaskStepKind,
} from './earnTaskPlan';
import type {
  IEarnTransactionStepAction,
  IEarnTransactionStepStatus,
} from './transactionStep';

type ITransactionKind = Exclude<
  IEarnTaskStepKind,
  'sign' | 'external' | 'wait'
>;
type IInitialStatus = { type: 'waiting' } | { type: 'ready' };
type ISignStatus =
  | IInitialStatus
  | { type: 'running' }
  | { type: 'completed' }
  | { type: 'skipped' }
  | { type: 'cancelled' }
  | { type: 'failed' };
type IExternalStatus =
  | IInitialStatus
  | { type: 'preparing' }
  | { type: 'executing' }
  | { type: 'completed' }
  | { type: 'cancelled' }
  | { type: 'failed' }
  | { type: 'unknown' };
type IWaitStatus =
  | IInitialStatus
  | { type: 'checking' }
  | { type: 'completed' }
  | { type: 'continued' }
  | { type: 'cancelled' }
  | { type: 'failed' }
  | { type: 'unknown' };

type IBaseStep = { id: string; attemptId?: string };
export type IEarnWorkflowTaskStep =
  | (IBaseStep & {
      kind: ITransactionKind;
      status: IEarnTransactionStepStatus;
      lateSubmitted: 'unknown' | 'confirming';
      confirmationCallback?: 'pending' | 'failed';
    })
  | (IBaseStep & { kind: 'sign'; status: ISignStatus })
  | (IBaseStep & { kind: 'external'; status: IExternalStatus })
  | (IBaseStep & { kind: 'wait'; status: IWaitStatus });

export type IEarnWorkflowStepPlan =
  | {
      id: string;
      kind: ITransactionKind;
      lateSubmitted: 'unknown' | 'confirming';
    }
  | { id: string; kind: 'sign' }
  | { id: string; kind: 'external' }
  | { id: string; kind: 'wait' };

type ISignAction = 'start' | 'retry' | 'complete' | 'skip' | 'cancel' | 'fail';
type IExternalAction =
  | 'start'
  | 'retry'
  | 'invoke'
  | 'accepted'
  | 'acceptedAfterInvalidation'
  | 'rejected'
  | 'cancel'
  | 'fail'
  | 'resolvedNotApplied';
type IWaitAction =
  | 'start'
  | 'retry'
  | 'retryFailed'
  | 'complete'
  | 'continuePending'
  | 'unknown'
  | 'cancel'
  | 'fail';

export type IEarnWorkflowPlanChange =
  | { type: 'insertReset'; resetStepId: string }
  | { type: 'insertApproval'; approvalStepId: string; resetStepId?: string };

export type IEarnWorkflowTaskEvent = {
  taskId: string;
  stepId: string;
  attemptId: string;
  payload:
    | { kind: 'transaction'; action: IEarnTransactionStepAction }
    | { kind: 'planChange'; change: IEarnWorkflowPlanChange }
    | { kind: 'confirmationCallbackFailed' }
    | { kind: 'confirmationCallbackPending' }
    | {
        kind: 'confirmationCallbackSucceeded';
        handoff: boolean;
        allowanceCheckStepId?: string;
        continueAfterMissingTxid?: string;
      }
    | { kind: 'sign'; action: ISignAction }
    | { kind: 'external'; action: IExternalAction }
    | { kind: 'wait'; action: IWaitAction };
};

export type IEarnWorkflowTask<TIdentity extends IEarnTaskScope> = IEarnTask<
  TIdentity,
  IEarnWorkflowTaskStep
>;

/** The provider owns the immutable identity snapshot; no execution outputs belong in it. */
export function createEarnWorkflowTask<TIdentity extends IEarnTaskScope>({
  taskId,
  identity,
  steps,
}: {
  taskId: string;
  identity: TIdentity;
  steps: readonly IEarnWorkflowStepPlan[];
}): IEarnWorkflowTask<TIdentity> {
  if (!taskId || getEarnTaskStepIdentityError(steps)) {
    throw new OneKeyLocalError('Invalid Earn workflow task');
  }
  return {
    taskId,
    identity,
    steps: steps.map((step, index): IEarnWorkflowTaskStep => {
      const status: IInitialStatus = {
        type: index === 0 ? 'ready' : 'waiting',
      };
      if (
        step.kind === 'sign' ||
        step.kind === 'external' ||
        step.kind === 'wait'
      ) {
        return { id: step.id, kind: step.kind, status };
      }
      return {
        id: step.id,
        kind: step.kind,
        lateSubmitted: step.lateSubmitted,
        status,
      };
    }),
    currentStepIndex: 0,
  };
}

function nextSignStep(
  step: Extract<IEarnWorkflowTaskStep, { kind: 'sign' }>,
  attemptId: string,
  action: ISignAction,
): { step: IEarnWorkflowTaskStep; advance: boolean } | undefined {
  if (action === 'start' && step.status.type === 'ready')
    return {
      step: { ...step, attemptId, status: { type: 'running' } },
      advance: false,
    };
  if (
    action === 'retry' &&
    (step.status.type === 'cancelled' || step.status.type === 'failed') &&
    step.attemptId !== attemptId
  )
    return {
      step: { ...step, attemptId, status: { type: 'running' } },
      advance: false,
    };
  if (step.attemptId !== attemptId || step.status.type !== 'running')
    return undefined;
  if (action === 'complete' || action === 'skip')
    return {
      step: {
        ...step,
        status: { type: action === 'complete' ? 'completed' : 'skipped' },
      },
      advance: true,
    };
  if (action === 'cancel' || action === 'fail')
    return {
      step: {
        ...step,
        status: { type: action === 'cancel' ? 'cancelled' : 'failed' },
      },
      advance: false,
    };
  return undefined;
}

function nextExternalStep(
  step: Extract<IEarnWorkflowTaskStep, { kind: 'external' }>,
  attemptId: string,
  action: IExternalAction,
): { step: IEarnWorkflowTaskStep; advance: boolean } | undefined {
  if (action === 'start' && step.status.type === 'ready')
    return {
      step: { ...step, attemptId, status: { type: 'preparing' } },
      advance: false,
    };
  if (
    action === 'retry' &&
    (step.status.type === 'cancelled' || step.status.type === 'failed') &&
    step.attemptId !== attemptId
  )
    return {
      step: { ...step, attemptId, status: { type: 'preparing' } },
      advance: false,
    };
  if (step.attemptId !== attemptId) return undefined;
  if (action === 'invoke' && step.status.type === 'preparing')
    return { step: { ...step, status: { type: 'executing' } }, advance: false };
  if (
    action === 'acceptedAfterInvalidation' &&
    (step.status.type === 'executing' || step.status.type === 'unknown')
  )
    return { step: { ...step, status: { type: 'completed' } }, advance: false };
  if (
    action === 'accepted' &&
    (step.status.type === 'executing' || step.status.type === 'unknown')
  )
    return { step: { ...step, status: { type: 'completed' } }, advance: true };
  if (
    action === 'rejected' &&
    (step.status.type === 'executing' || step.status.type === 'unknown')
  )
    return { step: { ...step, status: { type: 'failed' } }, advance: false };
  // Only an authoritative provider result may establish that the action was not applied.
  if (action === 'resolvedNotApplied' && step.status.type === 'unknown')
    return { step: { ...step, status: { type: 'failed' } }, advance: false };
  if (
    (action === 'cancel' || action === 'fail') &&
    step.status.type === 'preparing'
  )
    return {
      step: {
        ...step,
        status: { type: action === 'cancel' ? 'cancelled' : 'failed' },
      },
      advance: false,
    };
  if (
    (action === 'cancel' || action === 'fail') &&
    step.status.type === 'executing'
  )
    return { step: { ...step, status: { type: 'unknown' } }, advance: false };
  return undefined;
}

function nextWaitStep(
  step: Extract<IEarnWorkflowTaskStep, { kind: 'wait' }>,
  attemptId: string,
  action: IWaitAction,
): { step: IEarnWorkflowTaskStep; advance: boolean } | undefined {
  if (action === 'start' && step.status.type === 'ready')
    return {
      step: { ...step, attemptId, status: { type: 'checking' } },
      advance: false,
    };
  if (
    ((action === 'retry' &&
      (step.status.type === 'unknown' || step.status.type === 'cancelled')) ||
      (action === 'retryFailed' && step.status.type === 'failed')) &&
    step.attemptId !== attemptId
  )
    return {
      step: { ...step, attemptId, status: { type: 'checking' } },
      advance: false,
    };
  if (step.attemptId !== attemptId || step.status.type !== 'checking')
    return undefined;
  if (action === 'complete')
    return { step: { ...step, status: { type: 'completed' } }, advance: true };
  if (action === 'continuePending')
    return { step: { ...step, status: { type: 'continued' } }, advance: true };
  if (action === 'unknown' || action === 'cancel' || action === 'fail') {
    let type: 'cancelled' | 'failed' | 'unknown' = 'unknown';
    if (action === 'cancel') type = 'cancelled';
    if (action === 'fail') type = 'failed';
    return {
      step: { ...step, status: { type } },
      advance: false,
    };
  }
  return undefined;
}

/** Rejected, stale and out-of-order events return the original task reference. */
export function reduceEarnWorkflowTask<TIdentity extends IEarnTaskScope>(
  task: IEarnWorkflowTask<TIdentity>,
  event: IEarnWorkflowTaskEvent,
): IEarnWorkflowTask<TIdentity> {
  const current = task.steps[task.currentStepIndex];
  if (
    event.taskId !== task.taskId ||
    !event.attemptId ||
    !current ||
    event.stepId !== current.id
  )
    return task;
  if (event.payload.kind === 'planChange') {
    const { change } = event.payload;
    if (
      current.attemptId !== event.attemptId ||
      current.status.type !== 'preparing'
    )
      return task;
    if (change.type === 'insertReset') {
      if (
        current.kind !== 'approve' ||
        !change.resetStepId ||
        task.steps.some((step) => step.id === change.resetStepId) ||
        !task.steps
          .slice(0, task.currentStepIndex)
          .some((step) => step.kind === 'resetApproval')
      )
        return task;
      const steps = task.steps.slice();
      steps[task.currentStepIndex] = {
        ...current,
        status: { type: 'waiting' },
      };
      steps.splice(task.currentStepIndex, 0, {
        id: change.resetStepId,
        kind: 'resetApproval',
        lateSubmitted: 'unknown',
        status: { type: 'ready' },
      });
      return { ...task, steps };
    }
    const { approvalStepId, resetStepId } = change;
    if (
      current.kind !== 'deposit' ||
      !approvalStepId ||
      (resetStepId !== undefined && !resetStepId) ||
      approvalStepId === resetStepId ||
      task.steps.some(
        (step) => step.id === approvalStepId || step.id === resetStepId,
      ) ||
      !task.steps
        .slice(0, task.currentStepIndex)
        .some((step) => step.kind === 'approve')
    )
      return task;
    const steps = task.steps.slice();
    steps[task.currentStepIndex] = { ...current, status: { type: 'waiting' } };
    const approval: IEarnWorkflowTaskStep = {
      id: approvalStepId,
      kind: 'approve',
      lateSubmitted: 'unknown',
      status: { type: resetStepId ? 'waiting' : 'ready' },
    };
    const inserted: IEarnWorkflowTaskStep[] = resetStepId
      ? [
          {
            id: resetStepId,
            kind: 'resetApproval',
            lateSubmitted: 'unknown',
            status: { type: 'ready' },
          },
          approval,
        ]
      : [approval];
    steps.splice(task.currentStepIndex, 0, ...inserted);
    return { ...task, steps };
  }
  let transition: { step: IEarnWorkflowTaskStep; advance: boolean } | undefined;
  if (
    current.kind !== 'sign' &&
    current.kind !== 'external' &&
    current.kind !== 'wait' &&
    (event.payload.kind === 'confirmationCallbackPending' ||
      event.payload.kind === 'confirmationCallbackSucceeded' ||
      event.payload.kind === 'confirmationCallbackFailed')
  ) {
    if (current.attemptId !== event.attemptId) return task;
    if (event.payload.kind === 'confirmationCallbackPending') {
      if (
        current.status.type !== 'awaitingUser' &&
        current.status.type !== 'sending'
      )
        return task;
      transition = {
        step: { ...current, confirmationCallback: 'pending' },
        advance: false,
      };
    } else if (event.payload.kind === 'confirmationCallbackSucceeded') {
      if (current.confirmationCallback !== 'pending') return task;
      if (event.payload.allowanceCheckStepId) {
        const next = task.steps[task.currentStepIndex + 1];
        if (
          event.payload.handoff ||
          current.kind !== 'approve' ||
          current.status.type !== 'unknown' ||
          current.status.txid ||
          current.status.chainConfirmed ||
          current.status.txidConflict ||
          next?.kind !== 'wait' ||
          next.id !== event.payload.allowanceCheckStepId
        )
          return task;
        transition = {
          step: { ...current, confirmationCallback: undefined },
          advance: true,
        };
      } else if (event.payload.continueAfterMissingTxid) {
        const next = task.steps[task.currentStepIndex + 1];
        if (
          event.payload.handoff ||
          current.kind !== 'swap' ||
          current.status.type !== 'unknown' ||
          current.status.txid ||
          current.status.chainConfirmed ||
          current.status.txidConflict ||
          next?.kind !== 'wait' ||
          next.id !== event.payload.continueAfterMissingTxid
        )
          return task;
        transition = {
          step: { ...current, confirmationCallback: undefined },
          advance: true,
        };
      } else if (event.payload.handoff) {
        const next = reduceEarnTransactionStep(
          current,
          { type: 'handoff', attemptId: event.attemptId },
          { lateSubmitted: current.lateSubmitted },
        );
        if (next)
          transition = {
            step: {
              ...current,
              status: next.status,
              confirmationCallback: undefined,
            },
            advance: next.advance,
          };
      } else
        transition = {
          step: { ...current, confirmationCallback: undefined },
          advance: false,
        };
    } else {
      const next = reduceEarnTransactionStep(
        current,
        { type: 'fail', attemptId: event.attemptId },
        { lateSubmitted: current.lateSubmitted },
      );
      if (next || current.status.type === 'unknown')
        transition = {
          step: {
            ...current,
            status: next?.status ?? current.status,
            confirmationCallback: 'failed',
          },
          advance: false,
        };
    }
  } else if (current.kind === 'sign' && event.payload.kind === 'sign') {
    transition = nextSignStep(current, event.attemptId, event.payload.action);
  } else if (current.kind === 'external' && event.payload.kind === 'external') {
    transition = nextExternalStep(
      current,
      event.attemptId,
      event.payload.action,
    );
  } else if (current.kind === 'wait' && event.payload.kind === 'wait') {
    transition = nextWaitStep(current, event.attemptId, event.payload.action);
  } else if (
    current.kind !== 'sign' &&
    current.kind !== 'external' &&
    current.kind !== 'wait' &&
    event.payload.kind === 'transaction'
  ) {
    const next = reduceEarnTransactionStep(
      current,
      { ...event.payload.action, attemptId: event.attemptId },
      { lateSubmitted: current.lateSubmitted },
    );
    if (next)
      transition = {
        step: { ...current, attemptId: next.attemptId, status: next.status },
        advance: next.advance,
      };
  }
  if (!transition) return task;
  const nextIndex = task.currentStepIndex + (transition.advance ? 1 : 0);
  const next = task.steps[nextIndex];
  if (transition.advance && next && next.status.type !== 'waiting') return task;
  const steps = [...task.steps];
  steps[task.currentStepIndex] = transition.step;
  if (transition.advance && next)
    steps[nextIndex] = { ...next, status: { type: 'ready' } };
  return { ...task, steps, currentStepIndex: nextIndex };
}
