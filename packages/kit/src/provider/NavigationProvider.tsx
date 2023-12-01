import { memo } from 'react';

import type { INavigationContainerProps } from '@onekeyhq/components';
import { NavigationContainer } from '@onekeyhq/components';
import { RootNavigator } from '@onekeyhq/kit/src/routes';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import buildLinking from '../routes/linking';

const webProps = platformEnv.isRuntimeBrowser
  ? ({
      documentTitle: {
        formatter: () => 'OneKey',
      },
      linking: buildLinking(),
    } as unknown as INavigationContainerProps)
  : undefined;

const NavigationApp = () => (
  <NavigationContainer {...webProps}>
    <RootNavigator />
  </NavigationContainer>
);
NavigationApp.displayName = 'NavigationApp';

export default memo(NavigationApp);
