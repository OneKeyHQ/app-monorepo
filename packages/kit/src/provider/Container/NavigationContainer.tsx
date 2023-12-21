import type { PropsWithChildren } from 'react';
import { memo } from 'react';

import { NavigationContainer as NavigationContainerComponent } from '@onekeyhq/components';
import { RootNavigator } from '@onekeyhq/kit/src/routes';

import { useRouterConfig } from '../../routes/config';

function BasicNavigationApp({ children }: PropsWithChildren) {
  const { containerProps, routerConfig } = useRouterConfig();
  return (
    <NavigationContainerComponent {...containerProps}>
      <RootNavigator config={routerConfig} />
      {children}
    </NavigationContainerComponent>
  );
}

export const NavigationContainer = memo(BasicNavigationApp);
