import { memo } from 'react';

import { NavigationContainer as NavigationContainerComponent } from '@onekeyhq/components';
import { RootNavigator } from '@onekeyhq/kit/src/routes';

function BasicNavigationApp() {
  return (
    <NavigationContainerComponent
      documentTitle={{
        formatter: () => 'OneKey',
      }}
    >
      <RootNavigator />
    </NavigationContainerComponent>
  );
}

export const NavigationContainer = memo(BasicNavigationApp);
