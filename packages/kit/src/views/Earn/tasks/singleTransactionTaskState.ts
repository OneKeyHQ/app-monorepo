import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createEarnTaskStore } from './createEarnTaskStore';
import { reduceEarnWorkflowTask } from './earnWorkflowTaskState';

import type { IEarnTaskScope, IEarnTaskStepKind } from './earnTaskPlan';
import type {
  IEarnTransactionStepAction,
  IEarnTransactionStepStatus,
} from './transactionStep';

export type IEarnSingleTransactionStep<TKind extends string> = {
  id: string;
  kind: TKind;
  attemptId?: string;
  status: IEarnTransactionStepStatus;
};

export type IEarnSingleTransactionTask<TIdentity, TKind extends string> = {
  taskId: string;
  identity: TIdentity;
  steps: IEarnSingleTransactionStep<TKind>[];
  currentStepIndex: number;
};

type IEvent = IEarnTransactionStepAction & {
  stepId: string;
  attemptId: string;
};

/** A fixed single-step task; dynamic plan changes belong to their domain. */
export function createEarnSingleTransactionTaskState<
  TIdentity extends IEarnTaskScope,
  TKind extends Exclude<IEarnTaskStepKind, 'sign' | 'external' | 'wait'>,
>({
  taskId,
  identity,
  step,
  lateSubmitted,
}: {
  taskId: string;
  identity: TIdentity;
  step: { id: string; kind: TKind };
  lateSubmitted: 'unknown' | 'confirming';
}) {
  type ITask = IEarnSingleTransactionTask<TIdentity, TKind>;
  const store = createEarnTaskStore<ITask, IEvent>({
    initialState: {
      taskId,
      identity,
      steps: [{ ...step, status: { type: 'ready' } }],
      currentStepIndex: 0,
    },
    reduce: (task, event) => {
      const workflow = {
        ...task,
        steps: task.steps.map((current) => ({ ...current, lateSubmitted })),
      };
      const next = reduceEarnWorkflowTask(workflow, {
        taskId: task.taskId,
        stepId: event.stepId,
        attemptId: event.attemptId,
        payload: { kind: 'transaction', action: event },
      });
      if (next === workflow) return task;
      const current = next.steps[0];
      if (
        next.steps.length !== 1 ||
        !current ||
        current.kind === 'sign' ||
        current.kind === 'external' ||
        current.kind === 'wait' ||
        current.kind !== step.kind
      )
        throw new OneKeyLocalError('Invalid single transaction task state');
      return {
        ...task,
        steps: [
          {
            id: current.id,
            kind: step.kind,
            attemptId: current.attemptId,
            status: current.status,
          },
        ],
        currentStepIndex: next.currentStepIndex,
      };
    },
  });
  const bind = (
    stepId: string,
    attemptId: string,
    action: IEarnTransactionStepAction,
  ): IEvent => ({ ...action, stepId, attemptId });
  return {
    getTask: store.getState,
    subscribe: store.subscribe,
    acquire: store.acquire,
    owns: store.owns,
    release: store.release,
    dispatch: (
      stepId: string,
      attemptId: string,
      action: IEarnTransactionStepAction,
    ) => store.dispatch(bind(stepId, attemptId, action)),
    dispatchBatch: (
      stepId: string,
      attemptId: string,
      actions: IEarnTransactionStepAction[],
    ) =>
      store.dispatchBatch(
        actions.map((action) => bind(stepId, attemptId, action)),
      ),
    applyPlanChange: (_stepId: string, _attemptId: string, _change: never) =>
      false,
  };
}
