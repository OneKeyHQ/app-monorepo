import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

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
      defaultLogger.app.page.isAppLocked(isLock);
      if (!isLock) {
        resolve();
        return;
      }
      const callback = () => {
        setTimeout(() => {
          resolve();
        }, 100);
        appEventBus.off(EAppEventBusNames.UnlockApp, callback);
        defaultLogger.app.page.removeUnlockJob();
      };
      defaultLogger.app.page.addUnlockJob();
      appEventBus.on(EAppEventBusNames.UnlockApp, callback);
    });
  });
};
