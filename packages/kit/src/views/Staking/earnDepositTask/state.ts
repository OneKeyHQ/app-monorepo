import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createEarnTaskStore } from '../../Earn/tasks/createEarnTaskStore';
import { getEarnTaskStepIdentityError } from '../../Earn/tasks/earnTaskPlan';
import { reduceEarnWorkflowTask } from '../../Earn/tasks/earnWorkflowTaskState';
import { normalizeTaskAccountAddress } from '../../Earn/tasks/taskAddress';

import type { IEarnTask, IEarnTaskStep } from '../../Earn/tasks/earnTaskPlan';
import type {
  IEarnWorkflowTask,
  IEarnWorkflowTaskEvent,
  IEarnWorkflowTaskStep,
} from '../../Earn/tasks/earnWorkflowTaskState';
import type {
  IEarnTransactionStepAction,
  IEarnTransactionStepStatus,
} from '../../Earn/tasks/transactionStep';

export type IDepositTaskIdentity = Readonly<{
  accountId: string;
  accountAddress: string;
  networkId: string;
  provider: string;
  vault: string;
  inputTokenAddress: string;
  depositTokenAddress: string;
  amount: string;
  spenderAddress: string;
  intent?: Readonly<{
    symbol: string;
    outputTokenAddress: string;
    depositTokenDecimals: number;
    term?: number;
    validatorPublicKey?: string;
    slippage?: number;
  }>;
}>;

export function isSameDepositTaskIdentity(
  left: IDepositTaskIdentity,
  right: IDepositTaskIdentity,
) {
  const sameAddress = (a: string, b: string) =>
    normalizeTaskAccountAddress(left.networkId, a) ===
    normalizeTaskAccountAddress(right.networkId, b);
  return (
    left.accountId === right.accountId &&
    left.networkId === right.networkId &&
    sameAddress(left.accountAddress, right.accountAddress) &&
    left.provider.toLowerCase() === right.provider.toLowerCase() &&
    sameAddress(left.vault, right.vault) &&
    sameAddress(left.inputTokenAddress, right.inputTokenAddress) &&
    sameAddress(left.depositTokenAddress, right.depositTokenAddress) &&
    left.amount === right.amount &&
    sameAddress(left.spenderAddress, right.spenderAddress) &&
    ((!left.intent && !right.intent) ||
      Boolean(
        left.intent &&
        right.intent &&
        left.intent.symbol === right.intent.symbol &&
        sameAddress(
          left.intent.outputTokenAddress,
          right.intent.outputTokenAddress,
        ) &&
        left.intent.depositTokenDecimals ===
          right.intent.depositTokenDecimals &&
        left.intent.term === right.intent.term &&
        left.intent.validatorPublicKey === right.intent.validatorPublicKey &&
        left.intent.slippage === right.intent.slippage,
      ))
  );
}

export type IDepositTaskStepKind =
  | 'wrap'
  | 'resetApproval'
  | 'approve'
  | 'deposit';

export type IDepositTaskStepStatus = IEarnTransactionStepStatus;

export type IDepositTaskStep = IEarnTaskStep<
  IDepositTaskStepKind,
  IDepositTaskStepStatus
>;

export type IDepositRecordingStatus =
  | 'pending'
  | 'failed'
  | 'succeeded'
  | 'superseded'
  | 'remoteUnknown'
  | 'localUnavailable'
  | 'notTracked';

export function isRetryableDepositRecordingStatus(
  status: IDepositRecordingStatus | undefined,
) {
  return status === 'failed' || status === 'localUnavailable';
}

export type IDepositTask = IEarnTask<IDepositTaskIdentity, IDepositTaskStep> & {
  recording?: {
    txid: string;
    status: IDepositRecordingStatus;
  };
};

export type IDepositTaskRecordingBinding = {
  taskId: string;
  stepId: string;
  attemptId: string;
};

export type IDepositTaskAction =
  | IEarnTransactionStepAction
  | { type: 'insertReset'; resetStepId: string }
  | {
      type: 'insertApproval';
      approvalStepId: string;
      resetStepId?: string;
    };

export type IDepositTaskEvent = IDepositTaskAction & {
  taskId: string;
  stepId: string;
  attemptId: string;
};

export function createDepositTask({
  taskId,
  identity,
  steps,
}: {
  taskId: string;
  identity: IDepositTaskIdentity;
  steps: { id: string; kind: IDepositTaskStepKind }[];
}): IDepositTask {
  const identityError = getEarnTaskStepIdentityError(steps);
  if (!taskId || identityError === 'empty') {
    throw new OneKeyLocalError('Invalid deposit task');
  }
  if (identityError === 'duplicate') {
    throw new OneKeyLocalError('Duplicate deposit task step');
  }
  const kinds = steps.map((step) => step.kind);
  if (
    kinds.at(-1) !== 'deposit' ||
    kinds.filter((kind) => kind === 'deposit').length !== 1 ||
    kinds.filter((kind) => kind === 'wrap').length > 1 ||
    (kinds.includes('wrap') && kinds[0] !== 'wrap') ||
    kinds.some(
      (kind, index) =>
        kind === 'resetApproval' && kinds[index + 1] !== 'approve',
    )
  ) {
    throw new OneKeyLocalError('Invalid deposit task plan');
  }
  return {
    taskId,
    identity: Object.freeze({
      ...identity,
      ...(identity.intent
        ? { intent: Object.freeze({ ...identity.intent }) }
        : {}),
    }),
    steps: steps.map((step, index) => ({
      ...step,
      status: { type: index === 0 ? 'ready' : 'waiting' },
    })),
    currentStepIndex: 0,
  };
}

function isDepositTaskStep(
  step: IEarnWorkflowTaskStep,
): step is IDepositTaskStep & {
  lateSubmitted: 'unknown' | 'confirming';
  confirmationCallback?: 'pending' | 'failed';
} {
  return (
    step.kind === 'wrap' ||
    step.kind === 'resetApproval' ||
    step.kind === 'approve' ||
    step.kind === 'deposit'
  );
}

export function reduceDepositTask(
  task: IDepositTask,
  event: IDepositTaskEvent,
): IDepositTask {
  const step = task.steps[task.currentStepIndex];
  if (!step || event.taskId !== task.taskId || event.stepId !== step.id) {
    return task;
  }
  if (event.type === 'handoff' && step.kind !== 'deposit') return task;
  if (
    event.type === 'skip' &&
    step.kind !== 'approve' &&
    step.kind !== 'resetApproval'
  )
    return task;

  let payload: IEarnWorkflowTaskEvent['payload'];
  if (event.type === 'insertReset') {
    payload = {
      kind: 'planChange',
      change: { type: 'insertReset', resetStepId: event.resetStepId },
    };
  } else if (event.type === 'insertApproval') {
    payload = {
      kind: 'planChange',
      change: {
        type: 'insertApproval',
        approvalStepId: event.approvalStepId,
        ...(event.resetStepId !== undefined
          ? { resetStepId: event.resetStepId }
          : {}),
      },
    };
  } else {
    payload = { kind: 'transaction', action: event };
  }
  const workflowTask: IEarnWorkflowTask<IDepositTaskIdentity> = {
    ...task,
    steps: task.steps.map((item) => ({
      ...item,
      lateSubmitted: item.kind === 'deposit' ? 'confirming' : 'unknown',
    })),
  };
  const next = reduceEarnWorkflowTask(workflowTask, {
    taskId: event.taskId,
    stepId: event.stepId,
    attemptId: event.attemptId,
    payload,
  });
  if (next === workflowTask) return task;
  if (!next.steps.every(isDepositTaskStep)) {
    throw new OneKeyLocalError('Invalid deposit task step');
  }
  const previous = new Map(task.steps.map((item) => [item.id, item]));
  const steps = next.steps.map((item) => {
    const original = previous.get(item.id);
    if (
      original &&
      original.kind === item.kind &&
      original.attemptId === item.attemptId &&
      original.status === item.status
    ) {
      return original;
    }
    const {
      lateSubmitted: _lateSubmitted,
      confirmationCallback: _callback,
      ...value
    } = item;
    return value;
  });
  return { ...task, steps, currentStepIndex: next.currentStepIndex };
}

export function createDepositTaskState(initialTask: IDepositTask) {
  const store = createEarnTaskStore<IDepositTask, IDepositTaskEvent>({
    initialState: initialTask,
    reduce: reduceDepositTask,
  });
  let recordingOwner: symbol | undefined;
  return {
    getTask: store.getState,
    dispatch: store.dispatch,
    dispatchBatch: store.dispatchBatch,
    setRecording: (
      owner: symbol,
      binding: IDepositTaskRecordingBinding,
      recording: NonNullable<IDepositTask['recording']>,
    ) => {
      return store.update((task) => {
        const deposit = task.steps.at(-1);
        if (
          binding.taskId !== task.taskId ||
          deposit?.id !== binding.stepId ||
          deposit.kind !== 'deposit' ||
          deposit.attemptId !== binding.attemptId ||
          (deposit.status.type !== 'handedOff' &&
            !(
              deposit.status.type === 'unknown' && !deposit.status.txidConflict
            )) ||
          deposit.status.txid !== recording.txid ||
          (recordingOwner !== undefined && recordingOwner !== owner) ||
          (recordingOwner === undefined && task.recording !== undefined)
        )
          return { state: task, result: false };
        recordingOwner = owner;
        if (
          task.recording?.txid === recording.txid &&
          task.recording.status === recording.status
        )
          return { state: task, result: true };
        return {
          state: { ...task, recording: { ...recording } },
          result: true,
        };
      });
    },
    subscribe: store.subscribe,
    acquire: store.acquire,
    owns: store.owns,
    release: store.release,
  };
}

export type IDepositTaskState = ReturnType<typeof createDepositTaskState>;
