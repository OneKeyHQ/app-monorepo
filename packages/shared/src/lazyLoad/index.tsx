import { Suspense, lazy, memo } from 'react';

const LazyLoad = (factory: () => Promise<{ default: any }>) => {
  const Component = lazy(factory);
  function LazyLoadContainer(props: any) {
    return (
      <Suspense>
        <Component {...props} />
      </Suspense>
    );
  }
  return memo(LazyLoadContainer);
};

export default LazyLoad;
