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

const checkNotInResetting = () => {
  if (isResetting) {
    throw new OneKeyLocalError('Cannot perform operation while resetting');
  }
};

export default {
  startResetting,
  endResetting,
  getIsResetting,
  checkNotInResetting,
  suspendSnapshotWrites,
  isSnapshotWriteSuspended,
};
