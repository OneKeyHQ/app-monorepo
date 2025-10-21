import { Stack } from '@onekeyhq/components';
import { NetworkStatusBadge } from '@onekeyhq/kit/src/components/NetworkStatusBadge';

import { Layout } from './utils/Layout';

const Demo = () => {
  return (
    <Layout
      componentName="NetworkStatusBadge"
      getFilePath={() => __CURRENT_FILE_PATH__}
      elements={[
        {
          title: 'Connected',
          element: (
            <Stack gap="$2" alignItems="center">
              <NetworkStatusBadge connected />
            </Stack>
          ),
        },
        {
          title: 'Disconnected',
          element: (
            <Stack gap="$2" alignItems="center">
              <NetworkStatusBadge connected={false} />
            </Stack>
          ),
        },
      ]}
    />
  );
};

export default Demo;
