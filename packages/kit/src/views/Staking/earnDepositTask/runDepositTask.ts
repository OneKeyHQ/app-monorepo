import { Toast } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { createDepositTaskController } from './controller';
import {
  createDepositTaskState,
  isRetryableDepositRecordingStatus,
} from './state';

import type { IDepositTaskAdapter } from './controller';
import type {
  IDepositTask,
  IDepositTaskRecordingBinding,
  IDepositTaskState,
} from './state';
import type { IDepositTaskHandle } from './types';

type IRecordingState = NonNullable<IDepositTask['recording']>;
export type IRecordingResult =
  | void
  | 'superseded'
  | 'remoteUnknown'
  | 'localUnavailable'
  | 'notTracked'
  | 'recordedAwaitingOwner'
  | 'untrackedAwaitingOwner';

export type IRecoverableDepositTaskHandle = IDepositTaskHandle & {
  subscribeRecovery: (listener: () => void) => () => void;
  retryDetachedRecording: (isCurrent: () => boolean) => Promise<void>;
};

export function createDepositRecording({
  isCurrent,
  onError,
}: {
  isCurrent: () => boolean;
  onError: (error: unknown) => void;
}) {
  let state: IRecordingState | undefined;
  let operation: (() => Promise<IRecordingResult>) | undefined;
  let onComplete: (() => void | Promise<void>) | undefined;
  let pending: Promise<void> | undefined;
  let listener: (() => void) | undefined;
  let stateListener:
    | ((
        binding: IDepositTaskRecordingBinding,
        state: IRecordingState,
      ) => boolean)
    | undefined;
  let binding: IDepositTaskRecordingBinding | undefined;
  let active = true;
  const publish = () => {
    if (stateListener && (!binding || !state || !stateListener(binding, state)))
      return false;
    listener?.();
    return true;
  };
  const run = (canStart?: () => boolean, propagateError = false) => {
    if (!state || !operation || pending) return pending ?? Promise.resolve();
    state = { ...state, status: 'pending' };
    if (!publish()) {
      state = undefined;
      operation = undefined;
      onComplete = undefined;
      binding = undefined;
      return Promise.resolve();
    }
    const currentOperation = operation;
    pending = (async () => {
      let result: IRecordingResult;
      try {
        const outcome = await Promise.resolve().then(async () => {
          if (canStart && !canStart()) return { cancelled: true } as const;
          return {
            cancelled: false,
            result: await currentOperation(),
          } as const;
        });
        if (outcome.cancelled) {
          if (state) state = { ...state, status: 'failed' };
          publish();
          return;
        }
        result = outcome.result;
      } catch (error) {
        if (!state) return;
        state = { ...state, status: 'failed' };
        if (!publish()) return;
        if (propagateError && canStart?.()) throw error;
        if (active && isCurrent()) onError(error);
        return;
      } finally {
        pending = undefined;
      }
      if (!state) return;
      let nextStatus: IRecordingState['status'] = 'succeeded';
      if (result === 'untrackedAwaitingOwner') nextStatus = 'notTracked';
      else if (result && result !== 'recordedAwaitingOwner')
        nextStatus = result;
      state = {
        ...state,
        status: nextStatus,
      };
      if (!publish()) return;
      if (result === 'remoteUnknown' || result === 'localUnavailable') {
        if (propagateError && canStart?.()) {
          throw new OneKeyLocalError(
            'Earn order synchronization is incomplete',
          );
        }
        if (active && isCurrent())
          onError(
            new OneKeyLocalError('Earn order synchronization is incomplete'),
          );
        return;
      }
      if (
        result === 'recordedAwaitingOwner' ||
        result === 'untrackedAwaitingOwner'
      )
        return;
      if (active && isCurrent()) {
        try {
          await onComplete?.();
        } catch (error) {
          onError(error);
        }
      }
    })();
    return pending;
  };
  return {
    getState: () => state,
    isActive: () => active,
    subscribe: (next?: () => void) => {
      listener = next;
    },
    subscribeState: (
      next: (
        binding: IDepositTaskRecordingBinding,
        state: IRecordingState,
      ) => boolean,
    ) => {
      stateListener = next;
    },
    deactivate: () => {
      active = false;
      listener = undefined;
    },
    start: (
      txid: string,
      save: () => Promise<IRecordingResult>,
      complete: () => void | Promise<void>,
      nextBinding?: IDepositTaskRecordingBinding,
    ) => {
      if (state) return pending ?? Promise.resolve();
      binding = nextBinding;
      state = { txid, status: 'pending' };
      operation = save;
      onComplete = complete;
      return run();
    },
    retry: () => {
      if (
        !active ||
        !isCurrent() ||
        !isRetryableDepositRecordingStatus(state?.status)
      )
        return Promise.resolve();
      return run();
    },
    retryDetached: (isRecoveryCurrent: () => boolean) => {
      if (
        !isRecoveryCurrent() ||
        !isRetryableDepositRecordingStatus(state?.status)
      )
        return Promise.resolve();
      return run(isRecoveryCurrent, true);
    },
  };
}

export async function runDepositTask<TPrepared>({
  task,
  taskState,
  resume = false,
  adapter,
  signal,
  isCurrent,
  onTaskReady,
  onTaskChange,
  onFail,
  formatMessage,
  recording,
  canPublishRecording,
}: {
  task: IDepositTask;
  taskState?: IDepositTaskState;
  resume?: boolean;
  adapter: IDepositTaskAdapter<TPrepared>;
  signal: AbortSignal;
  isCurrent: () => boolean;
  onTaskReady?: (handle: IDepositTaskHandle) => boolean | void;
  onTaskChange?: (task: IDepositTask) => void;
  onFail?: (error: Error) => void;
  formatMessage: (id: ETranslations) => string;
  recording?: ReturnType<typeof createDepositRecording>;
  canPublishRecording?: () => boolean;
}): Promise<boolean> {
  if (resume && !taskState) {
    throw new OneKeyLocalError('Missing retained deposit task state');
  }
  const isTaskCurrent = () => !signal.aborted && isCurrent();
  const state = taskState ?? createDepositTaskState(task);
  const recordingOwner = Symbol('deposit-task-recording');
  recording?.subscribeState((binding, snapshot) =>
    state.setRecording(recordingOwner, binding, snapshot),
  );
  let failure: unknown;
  let sawFailure = false;
  let initialRunDone = false;
  const recoveryListeners = new Set<() => void>();
  const publishRecovery = () =>
    recoveryListeners.forEach((listener) => listener());
  const getTask = state.getTask;
  const publishTask = () => {
    publishRecovery();
    if (isTaskCurrent()) onTaskChange?.(getTask());
  };
  const publishRecording = () => {
    publishRecovery();
    if (canPublishRecording?.() ?? isTaskCurrent()) onTaskChange?.(getTask());
  };
  const controller = createDepositTaskController({
    task,
    taskState: state,
    adapter,
    isCurrent: isTaskCurrent,
    onChange: () => publishTask(),
    onStaleChange: () => publishRecording(),
    onError: (error) => {
      if (initialRunDone && isTaskCurrent()) {
        if (onFail && error instanceof Error) onFail(error);
        else errorToastUtils.showToastOfError(error);
      } else {
        failure = error;
        sawFailure = true;
      }
    },
  });
  const abort = () => controller.cancel();
  signal.addEventListener('abort', abort, { once: true });
  let disposed = false;
  const handle: IRecoverableDepositTaskHandle = {
    ...controller,
    taskState: state,
    getTask,
    isExecutionCurrent: isTaskCurrent,
    retryRecording: () => recording?.retry() ?? Promise.resolve(),
    retryDetachedRecording: (isRecoveryCurrent) =>
      recording?.retryDetached(isRecoveryCurrent) ?? Promise.resolve(),
    subscribeRecovery: (listener) => {
      recoveryListeners.add(listener);
      return () => recoveryListeners.delete(listener);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      signal.removeEventListener('abort', abort);
      recording?.deactivate();
      controller.cancel();
      recoveryListeners.clear();
    },
  };
  recording?.subscribe(publishRecording);
  let accepted: boolean | void;
  try {
    accepted = onTaskReady?.(handle);
  } catch (error) {
    handle.dispose();
    throw error;
  }
  if (accepted === false) {
    handle.dispose();
    return false;
  }
  onTaskChange?.(getTask());
  try {
    const resumedStep = getTask().steps[getTask().currentStepIndex];
    if (
      resume &&
      (resumedStep?.status.type === 'cancelled' ||
        resumedStep?.status.type === 'failed')
    ) {
      await controller.retry();
    } else if (
      resume &&
      (resumedStep?.status.type === 'unknown' ||
        resumedStep?.status.type === 'confirming' ||
        resumedStep?.status.type === 'verifying')
    ) {
      await controller.retryStatus();
    } else {
      await controller.run();
    }
    initialRunDone = true;
    if (sawFailure) {
      if (!isTaskCurrent()) return false;
      if (onFail && failure instanceof Error) {
        onFail(failure);
        return false;
      }
      throw failure instanceof Error
        ? failure
        : new OneKeyLocalError(String(failure));
    }
    const result = controller.getTask();
    const step = result.steps[result.currentStepIndex];
    if (
      isTaskCurrent() &&
      step?.status.type === 'failed' &&
      step.status.stage === 'onChain'
    ) {
      Toast.error({ title: formatMessage(ETranslations.global_failed) });
    } else if (step?.status.type === 'unknown' && isTaskCurrent()) {
      Toast.message({ title: formatMessage(ETranslations.global_pending) });
    }
    return (
      result.steps.at(-1)?.status.type === 'handedOff' &&
      (result.recording
        ? result.recording.status === 'succeeded' ||
          result.recording.status === 'superseded' ||
          result.recording.status === 'notTracked'
        : !recording)
    );
  } finally {
    initialRunDone = true;
    if (
      !onTaskReady ||
      controller.getTask().currentStepIndex >= controller.getTask().steps.length
    ) {
      signal.removeEventListener('abort', abort);
    }
  }
}
