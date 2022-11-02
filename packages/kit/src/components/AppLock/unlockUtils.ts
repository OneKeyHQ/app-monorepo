import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import store from '../../store';
import { wait } from '../../utils/helper';

let prevUnlockCallback: () => Promise<void> | undefined;
async function runAfterUnlock(
  callback: () => Promise<any> | void,
  { ignoreExt = true }: { ignoreExt?: boolean } = {},
) {
  if (ignoreExt && platformEnv.isExtension) {
    return callback();
  }
  await wait(0); // TODO wait store ready
  const isUnlock = store.getState()?.status?.isUnlock;
  if (isUnlock) {
    return callback();
  }
  return new Promise((resolve) => {
    prevUnlockCallback = async () => {
      // wait native app home mounted ready after unlock
      if (platformEnv.isNative) {
        await wait(1500);
      } else {
        await wait(600);
      }
      // alert(1111);
      resolve(await callback());
    };
    const isExtBg = platformEnv.isExtensionBackground;
    if (isExtBg) {
      if (prevUnlockCallback) {
        appEventBus.off(AppEventBusNames.Unlocked, prevUnlockCallback);
      }
      appEventBus.once(AppEventBusNames.Unlocked, prevUnlockCallback);
    } else {
      if (prevUnlockCallback) {
        appUIEventBus.off(AppUIEventBusNames.Unlocked, prevUnlockCallback);
      }
      appUIEventBus.once(AppUIEventBusNames.Unlocked, prevUnlockCallback);
    }
  });
}

export default {
  runAfterUnlock,
};
