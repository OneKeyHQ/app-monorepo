import { SizableText } from '@onekeyhq/components';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import { Layout } from './utils/Layout';

let i = 1;
const fetchResult = () =>
  new Promise<number>((resolve) => {
    i += 1;
    resolve(i);
  });

const UsePromiseResultGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="UsePromiseResult"
    elements={[
      {
        title: 'Native',
        // eslint-disable-next-line react/no-unstable-nested-components
        element: () => {
          // oxlint-disable-next-line react/rules-of-hooks, react/exhaustive-deps
          // eslint-disable-next-line react-hooks/rules-of-hooks, react-hooks/exhaustive-deps
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
