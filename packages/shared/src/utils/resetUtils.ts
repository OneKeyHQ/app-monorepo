import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

let isResetting = false;
let resetGeneration = 0;
let resetGuardCount = 0;
const resetSensitiveTasks = new Set<Promise<unknown>>();

const RESET_SENSITIVE_TASK_DRAIN_TIMEOUT_MS = 30_000;

const startResetting = () => {
  resetGuardCount += 1;
  if (resetGuardCount > 1) {
    return;
  }
  resetGeneration += 1;
  isResetting = true;
  timerUtils.disableSetInterval();
};

const endResetting = () => {
  resetGuardCount = Math.max(0, resetGuardCount - 1);
  if (resetGuardCount > 0) {
    return;
  }
  isResetting = false;
  timerUtils.enableSetInterval();
};

const getIsResetting = () => isResetting;

const getResetGeneration = () => resetGeneration;

const checkResetGeneration = (generation: number) => {
  if (isResetting || generation !== resetGeneration) {
    throw new OneKeyLocalError('Operation crossed a reset boundary');
  }
};

const trackResetSensitiveTask = <T>(task: Promise<T>): Promise<T> => {
  resetSensitiveTasks.add(task);
  void task.then(
    () => resetSensitiveTasks.delete(task),
    () => resetSensitiveTasks.delete(task),
  );
  return task;
};

const waitForResetSensitiveTasksToSettle = async ({
  deadlineAt = Date.now() + RESET_SENSITIVE_TASK_DRAIN_TIMEOUT_MS,
}: {
  deadlineAt?: number;
} = {}): Promise<void> => {
  while (resetSensitiveTasks.size > 0) {
    const remainingTimeMs = deadlineAt - Date.now();
    if (remainingTimeMs <= 0) {
      throw new OneKeyLocalError(
        'Reset-sensitive task drain deadline exceeded',
      );
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.allSettled(resetSensitiveTasks),
        new Promise<never>((_resolve, reject) => {
          timeout = timerUtils.setTimeoutUnrestricted(() => {
            reject(
              new OneKeyLocalError(
                'Reset-sensitive task drain deadline exceeded',
              ),
            );
          }, remainingTimeMs);
        }),
      ]);
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }
};

const runWithResettingGuard = async <T>(task: () => Promise<T>): Promise<T> => {
  startResetting();

  try {
    return await task();
  } finally {
    endResetting();
  }
};

const checkNotInResetting = () => {
  if (isResetting) {
    throw new OneKeyLocalError('Cannot perform operation while resetting');
  }
};

export default {
  RESET_SENSITIVE_TASK_DRAIN_TIMEOUT_MS,
  startResetting,
  endResetting,
  getIsResetting,
  getResetGeneration,
  checkResetGeneration,
  trackResetSensitiveTask,
  waitForResetSensitiveTasksToSettle,
  runWithResettingGuard,
  checkNotInResetting,
};
