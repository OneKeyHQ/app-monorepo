import { memo } from 'react';

import { Stack } from '@onekeyhq/components';
import useIsVerticalLayout from '@onekeyhq/components/src/Provider/hooks/useIsVerticalLayout';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

let ExplorerDesktop: any;

function Explorer() {
  const isVerticalLayout = useIsVerticalLayout();

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  ExplorerDesktop = require('./Desktop/ExplorerDesktop').default;

  return (
    <Stack flex={1} bg="background-default">
      {isVerticalLayout ? <ExplorerDesktop /> : <ExplorerDesktop />}
    </Stack>
  );
}

export default memo(Explorer);
