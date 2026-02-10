import { startTransition, useEffect, useState } from 'react';

import { View } from 'react-native';

import { globalJotaiStorageReadyHandler } from '@onekeyhq/kit-bg/src/states/jotai/jotaiStorage';

export function GlobalJotaiReady({ children }: { children: any }) {
  const [isReady, setIsReady] = useState(
    () => globalJotaiStorageReadyHandler.isReady,
  );
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[LANDING_DEBUG] GlobalJotaiReady render, isReady=${isReady}, syncReady=${globalJotaiStorageReadyHandler.isReady}, +${(performance.now() - ((globalThis as any).$$debugT0 ?? 0)).toFixed(1)}ms`);
  }
  useEffect(() => {
    if (!globalJotaiStorageReadyHandler.isReady) {
      void globalJotaiStorageReadyHandler.ready.then((ready) => {
        startTransition(() => {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[LANDING_DEBUG] GlobalJotaiReady resolved, ready=${ready}, +${(performance.now() - ((globalThis as any).$$debugT0 ?? 0)).toFixed(1)}ms`);
          }
          setIsReady(ready);
        });
      });
    }
  }, []);

  if (!isReady) {
    return <View testID="GlobalJotaiReady-not-ready-placeholder" />;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return children;
}
