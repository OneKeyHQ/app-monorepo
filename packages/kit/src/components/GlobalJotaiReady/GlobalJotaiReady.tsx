import { startTransition, useEffect, useState } from 'react';

import { View } from 'react-native';

import { globalColdStartHydrationReadyHandler } from '@onekeyhq/kit-bg/src/states/jotai/coldStartReady';
import { globalJotaiStorageReadyHandler } from '@onekeyhq/kit-bg/src/states/jotai/jotaiStorage';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Web/desktop unblock React as soon as cold-start hydration finishes,
// instead of waiting for the full jotaiInit pass. jotaiInit continues to
// run in the background; its reconcile set may trigger one re-render per
// persist atom, visually no-op when the mirror equals source-of-truth.
// Native/extension keep the existing gate to preserve current boot semantics.
const readyHandler =
  platformEnv.isWeb || platformEnv.isDesktop
    ? globalColdStartHydrationReadyHandler
    : globalJotaiStorageReadyHandler;

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
  const [isReady, setIsReady] = useState(() => readyHandler.isReady);
  logGlobalJotaiReady(
    `render isReady=${isReady}, syncReady=${readyHandler.isReady}`,
  );
  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog(
      'GlobalJotaiReady render',
      `isReady=${isReady}, syncReady=${readyHandler.isReady}`,
    );
  }
  useEffect(() => {
    if (readyHandler.isReady) {
      logGlobalJotaiReady('effect sees ready=true, rendering children');
      setIsReady(true);
      return;
    }
    logGlobalJotaiReady('effect waiting for ready promise');
    let isMounted = true;
    void readyHandler.ready.then((ready) => {
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
