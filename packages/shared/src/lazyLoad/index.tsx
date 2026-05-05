import { Suspense, lazy, memo } from 'react';
import type { ComponentType } from 'react';

import {
  LogLevel,
  NativeLogger,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';

const delayImport = <T,>(
  factory: () => Promise<{ default: ComponentType<T> }>,
  delayMs: number,
) =>
  new Promise<{ default: ComponentType<T> }>((resolve) => {
    setTimeout(() => resolve(factory()), delayMs);
  });

function LazyLoad<T = Record<string, unknown>>(
  factory: () => Promise<{ default: ComponentType<T> }>,
  delayMs?: number,
  fallback?: React.ReactNode,
) {
  const wrappedFactory =
    delayMs && delayMs > 0 ? () => delayImport(factory, delayMs) : factory;
  const LazyLoadComponent = lazy(() =>
    wrappedFactory().catch((err: Error) => {
      NativeLogger.write(
        LogLevel.Error,
        `[LazyLoad] FAILED: ${err?.message || err}\n${err?.stack?.slice(0, 300) || ''}`,
      );
      throw err;
    }),
  );
  function LazyLoadContainer(props: T) {
    return (
      <Suspense fallback={fallback}>
        <LazyLoadComponent {...(props as any)} />
      </Suspense>
    );
  }
  return memo(LazyLoadContainer);
}

export default LazyLoad;
