import { Suspense, lazy, memo } from 'react';

const delayImport = (
  factory: () => Promise<{ default: any }>,
  delayMs: number,
) =>
  new Promise<{ default: any }>((resolve) => {
    setTimeout(() => resolve(factory()), delayMs);
  });

const LazyLoad = (
  factory: () => Promise<{ default: any }>,
  delayMs?: number,
) => {
  const LazyLoadComponent = lazy(
    delayMs && delayMs > 0 ? () => delayImport(factory, delayMs) : factory,
  );
  function LazyLoadContainer(props: any) {
    return (
      <Suspense>
        <LazyLoadComponent {...props} />
      </Suspense>
    );
  }
  return memo(LazyLoadContainer);
};

export default LazyLoad;
