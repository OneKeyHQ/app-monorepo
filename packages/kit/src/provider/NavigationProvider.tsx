import { memo } from 'react';

import { NavigationContainer } from '@onekeyhq/components';
import { RootNavigator } from '@onekeyhq/kit/src/routes';

const NavigationApp = () => (
  <NavigationContainer
    documentTitle={{
      formatter: () => 'OneKey',
    }}
  >
    <RootNavigator />
  </NavigationContainer>
);
NavigationApp.displayName = 'NavigationApp';

export default memo(NavigationApp);
