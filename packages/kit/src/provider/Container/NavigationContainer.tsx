import type { PropsWithChildren } from 'react';
import { memo, useRef } from 'react';

import {
  NavigationContainer as NavigationContainerComponent,
  RouterEventProvider,
} from '@onekeyhq/components';
import { RootNavigator } from '@onekeyhq/kit/src/routes';

import { useRouterConfig } from '../../routes/config';

import { TabFreezeOnBlurContainer } from './TabFreezeOnBlurContainer';

function BasicNavigation({ children }: PropsWithChildren) {
  const { containerProps, routerConfig } = useRouterConfig();
  return (
    <NavigationContainerComponent {...containerProps}>
      <TabFreezeOnBlurContainer>
        <RootNavigator config={routerConfig} />
      </TabFreezeOnBlurContainer>
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
