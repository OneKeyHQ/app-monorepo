import { startTransition, useEffect, useState } from 'react';

import { View } from 'react-native';

import { globalJotaiStorageReadyHandler } from '@onekeyhq/kit-bg/src/states/jotai/jotaiStorage';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const jsEntryStart: number =
  (globalThis as any).__ONEKEY_MAIN_ENTRY_START__ || Date.now();

function logGlobalJotaiReady(message: string) {
  if (
    platformEnv.isNativeMainThread &&
    platformEnv.enableNativeBackgroundThread
  ) {
    const elapsed = Date.now() - jsEntryStart;
    defaultLogger.app.appUpdate.log(
      `[GlobalJotaiReady] ${message} (+${elapsed}ms)`,
    );
  }
}

export function GlobalJotaiReady({ children }: { children: any }) {
  const [isReady, setIsReady] = useState(
    () => globalJotaiStorageReadyHandler.isReady,
  );
  logGlobalJotaiReady(
    `render isReady=${isReady}, syncReady=${globalJotaiStorageReadyHandler.isReady}`,
  );
  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog(
      'GlobalJotaiReady render',
      `isReady=${isReady}, syncReady=${globalJotaiStorageReadyHandler.isReady}`,
    );
  }
  useEffect(() => {
    if (globalJotaiStorageReadyHandler.isReady) {
      logGlobalJotaiReady('effect sees ready=true, rendering children');
      setIsReady(true);
      return;
    }
    logGlobalJotaiReady('effect waiting for ready promise');
    let isMounted = true;
    void globalJotaiStorageReadyHandler.ready.then((ready) => {
      if (!isMounted) return;
      logGlobalJotaiReady(`ready promise resolved: ${ready}`);
      startTransition(() => {
        if (process.env.NODE_ENV !== 'production') {
          debugLandingLog('GlobalJotaiReady resolved', `ready=${ready}`);
        }
        setIsReady(ready);
      });
    });
    return () => {
      isMounted = false;
    };
  }, []);

  if (!isReady) {
    logGlobalJotaiReady('returning placeholder');
    return <View testID="GlobalJotaiReady-not-ready-placeholder" />;
  }

  logGlobalJotaiReady('rendering children');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return children;
}
