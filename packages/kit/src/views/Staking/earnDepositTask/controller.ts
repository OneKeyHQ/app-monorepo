import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createEarnTransactionTaskController } from '../../Earn/tasks/transactionTaskController';

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
  ) => Promise<'success' | 'failed' | 'unknown' | 'allowanceSatisfied'>;
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
  return createEarnTransactionTaskController<
    IDepositTaskIdentity,
    IDepositTaskStep,
    IDepositTask,
    TPrepared,
    Extract<IDepositTaskAction, { type: 'insertReset' | 'insertApproval' }>,
    IDepositTaskPreparation<TPrepared>
  >({
    state: {
      getTask: state.getTask,
      acquire: state.acquire,
      owns: state.owns,
      release: state.release,
      dispatch: (stepId, attemptId, action) =>
        state.dispatch({
          ...action,
          taskId: initialTask.taskId,
          stepId,
          attemptId,
        }),
      dispatchBatch: (stepId, attemptId, actions) =>
        state.dispatchBatch(
          actions.map((action) => ({
            ...action,
            taskId: initialTask.taskId,
            stepId,
            attemptId,
          })),
        ),
      applyPlanChange: (stepId, attemptId, action) =>
        state.dispatch({
          ...action,
          taskId: initialTask.taskId,
          stepId,
          attemptId,
        }),
    },
    adapter,
    normalizePreparation: (preparation) => {
      if (
        preparation.type === 'insertReset' ||
        preparation.type === 'insertApproval'
      ) {
        return { type: 'change', change: preparation };
      }
      return preparation;
    },
    shouldHandoffOnSubmit: (step) => step.kind === 'deposit',
    isCurrent,
    onChange,
    onStaleChange,
    onError,
    expiredMessage: 'Deposit task confirmation expired',
  });
}
