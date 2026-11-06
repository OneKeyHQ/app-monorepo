import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { normalizeTaskAccountAddress } from './taskAddress';

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

export type IDepositTaskStepStatus =
  | { type: 'waiting' }
  | { type: 'ready' }
  | { type: 'preparing' }
  | { type: 'awaitingUser' }
  | { type: 'sending' }
  | { type: 'confirming'; txid: string }
  | { type: 'verifying'; txid: string }
  | { type: 'succeeded'; txid: string }
  | { type: 'handedOff'; txid: string }
  | { type: 'skipped' }
  | { type: 'cancelled' }
  | { type: 'failed'; stage: 'beforeSend' }
  | { type: 'failed'; stage: 'onChain'; txid: string }
  | {
      type: 'unknown';
      txid?: string;
      chainConfirmed: boolean;
      txidConflict?: readonly string[];
    };

export type IDepositTaskStep = {
  id: string;
  kind: IDepositTaskStepKind;
  attemptId?: string;
  status: IDepositTaskStepStatus;
};

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

export type IDepositTask = {
  taskId: string;
  identity: IDepositTaskIdentity;
  steps: IDepositTaskStep[];
  currentStepIndex: number;
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

export function isDepositRecordingBound(
  task: IDepositTask,
  binding: IDepositTaskRecordingBinding,
  txid: string,
) {
  const deposit = task.steps.at(-1);
  return Boolean(
    binding.taskId === task.taskId &&
    deposit?.id === binding.stepId &&
    deposit.kind === 'deposit' &&
    deposit.attemptId === binding.attemptId &&
    (deposit.status.type === 'handedOff' ||
      (deposit.status.type === 'unknown' && !deposit.status.txidConflict)) &&
    deposit.status.txid === txid,
  );
}

export type IDepositTaskAction =
  | { type: 'start' }
  | { type: 'retry' }
  | { type: 'confirmationOpened' }
  | { type: 'sendStarted' }
  | { type: 'sendBlocked' }
  | { type: 'submitted'; txid: string }
  | { type: 'lateBroadcastAccepted'; txid: string }
  | { type: 'txidConflict'; txid: string }
  | { type: 'confirmed' }
  | { type: 'handoff' }
  | { type: 'verified' }
  | { type: 'chainFailed' }
  | { type: 'fail' }
  | { type: 'cancel' }
  | { type: 'retryStatus' }
  | { type: 'skip' }
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
  if (!taskId || !steps.length || steps.some((step) => !step.id)) {
    throw new OneKeyLocalError('Invalid deposit task');
  }
  if (new Set(steps.map((step) => step.id)).size !== steps.length) {
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

export function reduceDepositTask(
  task: IDepositTask,
  event: IDepositTaskEvent,
): IDepositTask {
  const step = task.steps[task.currentStepIndex];
  if (!step || event.taskId !== task.taskId || event.stepId !== step.id) {
    return task;
  }
  if (
    event.type !== 'start' &&
    event.type !== 'retry' &&
    event.attemptId !== step.attemptId
  ) {
    return task;
  }

  let status: IDepositTaskStepStatus | undefined;
  let attemptId = step.attemptId;
  let advance = false;
  switch (event.type) {
    case 'start':
      if (step.status.type !== 'ready' || !event.attemptId) return task;
      attemptId = event.attemptId;
      status = { type: 'preparing' };
      break;
    case 'retry':
      if (
        (step.status.type !== 'failed' && step.status.type !== 'cancelled') ||
        !event.attemptId ||
        event.attemptId === step.attemptId
      )
        return task;
      attemptId = event.attemptId;
      status = { type: 'preparing' };
      break;
    case 'confirmationOpened':
      if (step.status.type !== 'preparing') return task;
      status = { type: 'awaitingUser' };
      break;
    case 'sendStarted':
      if (step.status.type !== 'awaitingUser') return task;
      status = { type: 'sending' };
      break;
    case 'sendBlocked':
      if (
        step.status.type !== 'sending' &&
        !(
          step.status.type === 'unknown' &&
          !step.status.txid &&
          !step.status.chainConfirmed &&
          !step.status.txidConflict
        )
      )
        return task;
      status = { type: 'failed', stage: 'beforeSend' };
      break;
    case 'submitted':
      if (
        step.status.type !== 'sending' &&
        step.status.type !== 'awaitingUser' &&
        !(
          step.status.type === 'unknown' &&
          !step.status.txid &&
          !step.status.chainConfirmed &&
          !step.status.txidConflict
        )
      )
        return task;
      if (!event.txid.trim()) {
        status = { type: 'unknown', chainConfirmed: false };
      } else if (step.status.type === 'unknown' && step.kind !== 'deposit') {
        status = {
          type: 'unknown',
          txid: event.txid.trim(),
          chainConfirmed: false,
        };
      } else {
        status = { type: 'confirming', txid: event.txid.trim() };
      }
      break;
    case 'lateBroadcastAccepted':
      if (
        !event.txid.trim() ||
        !(
          step.status.type === 'awaitingUser' ||
          step.status.type === 'sending' ||
          step.status.type === 'cancelled' ||
          (step.status.type === 'failed' &&
            step.status.stage === 'beforeSend') ||
          (step.status.type === 'unknown' &&
            !step.status.txid &&
            !step.status.chainConfirmed &&
            !step.status.txidConflict)
        )
      )
        return task;
      status = {
        type: 'unknown',
        txid: event.txid.trim(),
        chainConfirmed: false,
      };
      break;
    case 'txidConflict': {
      const first =
        step.status.type === 'confirming' ||
        step.status.type === 'verifying' ||
        step.status.type === 'unknown'
          ? step.status.txid
          : undefined;
      if (!first || !event.txid || first === event.txid) return task;
      status = {
        type: 'unknown',
        chainConfirmed: false,
        txidConflict: [first, event.txid],
      };
      break;
    }
    case 'confirmed':
      if (step.status.type !== 'confirming') return task;
      status = { type: 'verifying', txid: step.status.txid };
      break;
    case 'handoff':
      if (step.kind !== 'deposit' || step.status.type !== 'confirming')
        return task;
      status = { type: 'handedOff', txid: step.status.txid };
      advance = true;
      break;
    case 'verified':
      if (step.status.type !== 'verifying') return task;
      status = { type: 'succeeded', txid: step.status.txid };
      advance = true;
      break;
    case 'chainFailed':
      if (step.status.type !== 'confirming') return task;
      status = { type: 'failed', stage: 'onChain', txid: step.status.txid };
      break;
    case 'fail':
    case 'cancel':
      switch (step.status.type) {
        case 'preparing':
        case 'awaitingUser':
          status =
            event.type === 'cancel'
              ? { type: 'cancelled' }
              : { type: 'failed', stage: 'beforeSend' };
          break;
        case 'sending':
          status = { type: 'unknown', chainConfirmed: false };
          break;
        case 'confirming':
        case 'verifying':
          status = {
            type: 'unknown',
            txid: step.status.txid,
            chainConfirmed: step.status.type === 'verifying',
          };
          break;
        default:
          return task;
      }
      break;
    case 'retryStatus':
      if (step.status.type !== 'unknown' || !step.status.txid) return task;
      status = {
        type: step.status.chainConfirmed ? 'verifying' : 'confirming',
        txid: step.status.txid,
      };
      break;
    case 'insertReset': {
      if (
        step.kind !== 'approve' ||
        step.status.type !== 'preparing' ||
        !event.resetStepId ||
        task.steps.some((item) => item.id === event.resetStepId) ||
        !task.steps
          .slice(0, task.currentStepIndex)
          .some((item) => item.kind === 'resetApproval')
      ) {
        return task;
      }
      const steps = task.steps.slice();
      steps[task.currentStepIndex] = { ...step, status: { type: 'waiting' } };
      steps.splice(task.currentStepIndex, 0, {
        id: event.resetStepId,
        kind: 'resetApproval',
        status: { type: 'ready' },
      });
      return { ...task, steps };
    }
    case 'insertApproval': {
      const { approvalStepId, resetStepId } = event;
      if (
        step.kind !== 'deposit' ||
        step.status.type !== 'preparing' ||
        !approvalStepId ||
        (resetStepId !== undefined && !resetStepId) ||
        approvalStepId === resetStepId ||
        task.steps.some(
          (item) => item.id === approvalStepId || item.id === resetStepId,
        ) ||
        !task.steps
          .slice(0, task.currentStepIndex)
          .some((item) => item.kind === 'approve')
      ) {
        return task;
      }
      const steps = task.steps.slice();
      steps[task.currentStepIndex] = { ...step, status: { type: 'waiting' } };
      const approval: IDepositTaskStep = {
        id: approvalStepId,
        kind: 'approve',
        status: { type: resetStepId ? 'waiting' : 'ready' },
      };
      const inserted: IDepositTaskStep[] = resetStepId
        ? [
            {
              id: resetStepId,
              kind: 'resetApproval',
              status: { type: 'ready' },
            },
            approval,
          ]
        : [approval];
      steps.splice(task.currentStepIndex, 0, ...inserted);
      return { ...task, steps };
    }
    case 'skip':
      if (
        step.status.type !== 'preparing' ||
        (step.kind !== 'approve' && step.kind !== 'resetApproval')
      )
        return task;
      status = { type: 'skipped' };
      advance = true;
      break;
    default:
      return task;
  }
  if (!status) return task;
  const nextIndex = advance ? task.currentStepIndex + 1 : task.currentStepIndex;
  const steps = task.steps.map((item, index) => {
    if (index === task.currentStepIndex) return { ...item, attemptId, status };
    if (advance && index === nextIndex)
      return { ...item, status: { type: 'ready' as const } };
    return item;
  });
  return { ...task, currentStepIndex: nextIndex, steps };
}

export function createDepositTaskState(initialTask: IDepositTask) {
  let task = initialTask;
  let executionOwner: symbol | undefined;
  let recordingOwner: symbol | undefined;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const dispatchBatch = (events: IDepositTaskEvent[]) => {
    if (!events.length) return false;
    let next = task;
    for (const event of events) {
      const updated = reduceDepositTask(next, event);
      if (updated === next) return false;
      next = updated;
    }
    task = next;
    notify();
    return true;
  };
  return {
    getTask: () => task,
    dispatch: (event: IDepositTaskEvent) => dispatchBatch([event]),
    dispatchBatch,
    setRecording: (
      owner: symbol,
      binding: IDepositTaskRecordingBinding,
      recording: NonNullable<IDepositTask['recording']>,
    ) => {
      if (
        !isDepositRecordingBound(task, binding, recording.txid) ||
        (recordingOwner !== undefined && recordingOwner !== owner) ||
        (recordingOwner === undefined && task.recording !== undefined)
      )
        return false;
      recordingOwner = owner;
      if (
        task.recording?.txid === recording.txid &&
        task.recording.status === recording.status
      )
        return true;
      task = { ...task, recording: { ...recording } };
      notify();
      return true;
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    acquire: (owner: symbol) => {
      if (executionOwner && executionOwner !== owner) return false;
      executionOwner = owner;
      return true;
    },
    owns: (owner: symbol) => executionOwner === owner,
    release: (owner: symbol) => {
      if (executionOwner === owner) executionOwner = undefined;
    },
  };
}

export type IDepositTaskState = ReturnType<typeof createDepositTaskState>;
