import { Suspense, lazy, memo } from 'react';

const LazyLoad = (factory: () => Promise<{ default: any }>) => {
  const LazyLoadComponent = lazy(factory);
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
