import { Suspense, lazy, memo } from 'react';
import type { ComponentType } from 'react';

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
  const LazyLoadComponent = lazy(
    delayMs && delayMs > 0 ? () => delayImport(factory, delayMs) : factory,
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
