import type { ComponentType, ReactNode } from 'react';
import { Suspense, lazy } from 'react';

interface Params {
  fallback?: ReactNode;
  // props?: any;
}
export function createLazyComponent<T extends ComponentType<any>>(
  loadPromise: () => Promise<{ default: T }>,
  params?: Params,
) {
  const { fallback = null } = params || {};
  const LazyComp = lazy(loadPromise);
  return ((props: any) => (
    <Suspense fallback={fallback}>
      <LazyComp {...props} />
    </Suspense>
  )) as unknown as ComponentType;
}
