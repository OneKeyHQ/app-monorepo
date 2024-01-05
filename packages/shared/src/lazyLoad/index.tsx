import { Suspense, lazy, memo } from 'react';

const LazyLoad = (factory: () => Promise<{ default: any }>) => {
  const Component = lazy(factory);
  function Component1(props: any) {
    return (
      <Suspense>
        <Component {...props} />
      </Suspense>
    );
  }
  return memo(Component1);
};

export default LazyLoad;
