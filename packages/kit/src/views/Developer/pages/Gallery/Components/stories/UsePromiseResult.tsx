import { SizableText } from '@onekeyhq/components';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import { Layout } from './utils/Layout';

let i = 1;
const fetchResult = () =>
  new Promise((resolve) => {
    i += 1;
    resolve(i);
  });

const UsePromiseResultGallery = () => (
  <Layout
    description=""
    suggestions={['']}
    boundaryConditions={['']}
    elements={[
      {
        title: 'Native',
        // eslint-disable-next-line react/no-unstable-nested-components
        element: () => {
          // eslint-disable-next-line react-hooks/rules-of-hooks
          const { result } = usePromiseResult(fetchResult, [], {
            pollingInterval: 1500,
            initResult: 0,
          });
          return <SizableText>{result}</SizableText>;
        },
      },
    ]}
  />
);

export default UsePromiseResultGallery;
