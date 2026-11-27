import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

let isResetting = false;
let snapshotWritesSuspended = false;

const startResetting = () => {
  isResetting = true;
  timerUtils.disableSetInterval();
};

const endResetting = () => {
  isResetting = false;
  snapshotWritesSuspended = false;
  timerUtils.enableSetInterval();
};

const getIsResetting = () => isResetting;

const suspendSnapshotWrites = () => {
  snapshotWritesSuspended = true;
};

const isSnapshotWriteSuspended = () => isResetting || snapshotWritesSuspended;

const RESETTING_ERROR_MESSAGE = 'Cannot perform operation while resetting';

const checkNotInResetting = () => {
  if (isResetting) {
    throw new OneKeyLocalError(RESETTING_ERROR_MESSAGE);
  }
};

const isResettingError = (error: unknown) =>
  isResetting &&
  error instanceof OneKeyLocalError &&
  error.message === RESETTING_ERROR_MESSAGE;

export default {
  startResetting,
  endResetting,
  getIsResetting,
  checkNotInResetting,
  isResettingError,
  suspendSnapshotWrites,
  isSnapshotWriteSuspended,
};
