import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

let isResetting = false;

const startResetting = () => {
  isResetting = true;
  timerUtils.disableSetInterval();
};

const endResetting = () => {
  isResetting = false;
  timerUtils.enableSetInterval();
};

const getIsResetting = () => isResetting;

const checkNotInResetting = () => {
  if (isResetting) {
    throw new Error('Cannot perform operation while resetting');
  }
};

export default {
  startResetting,
  endResetting,
  getIsResetting,
  checkNotInResetting,
};
