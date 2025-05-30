import uuid from 'react-native-uuid';

import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

export const withPromptPasswordVerify = async <T>({
  run,
  options,
}: {
  run: () => Promise<T>;
  options?: { timeout?: number };
}): Promise<T> => {
  try {
    await backgroundApiProxy.servicePassword.openPasswordSecuritySession(
      options,
    );
    const result = await run();
    // Do something with the result if needed
    return result;
  } finally {
    await backgroundApiProxy.servicePassword.closePasswordSecuritySession();
  }
};

export const whenAppUnlocked = () => {
  return new Promise<void>((resolve) => {
    void backgroundApiProxy.serviceApp.isAppLocked().then(async (isLock) => {
      if (!isLock) {
        resolve();
        return;
      }
      const unlockJobId = uuid.v1().toString();
      const callback = (
        event: IAppEventBusPayload[EAppEventBusNames.UnlockApp],
      ) => {
        if (event.jobId === unlockJobId) {
          setTimeout(() => {
            resolve();
          }, 100);
          appEventBus.off(EAppEventBusNames.UnlockApp, callback);
        }
      };
      appEventBus.on(EAppEventBusNames.UnlockApp, callback);
      await backgroundApiProxy.serviceApp.addUnlockJob(unlockJobId);
    });
  });
};
