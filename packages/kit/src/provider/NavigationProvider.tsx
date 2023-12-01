import { memo } from 'react';

import type { INavigationContainerProps } from '@onekeyhq/components';
import { NavigationContainer } from '@onekeyhq/components';
import { RootNavigator } from '@onekeyhq/kit/src/routes';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const webProps = platformEnv.isRuntimeBrowser
  ? ({
      linking: {
        config: {},
      },
    } as INavigationContainerProps)
  : undefined;

const NavigationApp = () => (
  <NavigationContainer
    documentTitle={{
      formatter: () => 'OneKey',
    }}
    {...webProps}
  >
    <RootNavigator />
  </NavigationContainer>
);
NavigationApp.displayName = 'NavigationApp';

export default memo(NavigationApp);
