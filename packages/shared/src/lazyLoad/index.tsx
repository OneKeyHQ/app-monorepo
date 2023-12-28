import { Suspense, lazy } from 'react';

// eslint-disable-next-line react/display-name
const LazyLoad = (func: any) => (props: any) => {
  const Component = lazy(func);
  return (
    <Suspense>
      <Component {...props} />
    </Suspense>
  );
};

export default LazyLoad;
