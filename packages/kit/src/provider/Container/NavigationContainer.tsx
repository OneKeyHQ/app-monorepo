import { memo } from 'react';

import { NavigationContainer as NavigationContainerComponent } from '@onekeyhq/components';
import { RootNavigator } from '@onekeyhq/kit/src/routes';

import { useRouterConfig } from '../../routes/linking';

function BasicNavigationApp() {
  const { containerProps, routerConfig } = useRouterConfig();
  return (
    <NavigationContainerComponent {...containerProps}>
      <RootNavigator config={routerConfig} />
    </NavigationContainerComponent>
  );
}

export const NavigationContainer = memo(BasicNavigationApp);
