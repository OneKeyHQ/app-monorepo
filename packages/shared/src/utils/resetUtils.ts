import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

let isResetting = false;
let resetGeneration = 0;
let resetGuardCount = 0;

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
  startResetting,
  endResetting,
  getIsResetting,
  getResetGeneration,
  runWithResettingGuard,
  checkNotInResetting,
};
