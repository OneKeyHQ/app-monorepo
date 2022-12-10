import { ComponentType, ReactNode, Suspense, lazy } from 'react';

interface Params {
  fallback?: ReactNode;
  props?: any;
}
export function createLazyComponent<T extends ComponentType<any>>(
  loadPromise: () => Promise<{ default: T }>,
  params?: Params,
) {
  const { fallback = null, props = {} } = params || {};
  const LazyComp = lazy(loadPromise);
  return (() => (
    <Suspense fallback={fallback}>
      <LazyComp {...props} />
    </Suspense>
  )) as unknown as ComponentType;
}
