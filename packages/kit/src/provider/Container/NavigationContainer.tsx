import type { PropsWithChildren } from 'react';
import { memo, useRef } from 'react';

import {
  NavigationContainer as NavigationContainerComponent,
  RouterEventProvider,
} from '@onekeyhq/components';
import { RootNavigator } from '@onekeyhq/kit/src/routes';

import { useRouterConfig } from '../../routes/config';

function BasicNavigation({ children }: PropsWithChildren) {
  const { containerProps, routerConfig } = useRouterConfig();
  return (
    <NavigationContainerComponent {...containerProps}>
      <RootNavigator config={routerConfig} />
      {children}
    </NavigationContainerComponent>
  );
}

function NavigationWithEventProvider({ children }: PropsWithChildren) {
  const routerEventRef = useRef([]);
  return (
    <RouterEventProvider value={routerEventRef}>
      <BasicNavigation>{children}</BasicNavigation>
    </RouterEventProvider>
  );
}

export const NavigationContainer = memo(NavigationWithEventProvider);
