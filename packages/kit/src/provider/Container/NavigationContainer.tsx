import type { PropsWithChildren } from 'react';
import { memo, useMemo, useRef } from 'react';

import {
  NavigationContainer as NavigationContainerComponent,
  RouterEventProvider,
} from '@onekeyhq/components';
import { RootNavigator } from '@onekeyhq/kit/src/routes';

import { useRouterConfig } from '../../routes/config';

import { TabFreezeOnBlurContainer } from './TabFreezeOnBlurContainer';

function BasicNavigation({ children }: PropsWithChildren) {
  const { containerProps, routerConfig } = useRouterConfig();
  return useMemo(() => {
    return (
      <NavigationContainerComponent {...containerProps}>
        <TabFreezeOnBlurContainer>
          <RootNavigator config={routerConfig} />
        </TabFreezeOnBlurContainer>
        {children}
      </NavigationContainerComponent>
    );
  }, [children, containerProps, routerConfig]);
}

const MemoizedBasicNavigation = memo(BasicNavigation);

function NavigationWithEventProvider({ children }: PropsWithChildren) {
  const routerEventRef = useRef([]);
  return (
    <RouterEventProvider value={routerEventRef}>
      <MemoizedBasicNavigation>{children}</MemoizedBasicNavigation>
    </RouterEventProvider>
  );
}

export const NavigationContainer = memo(NavigationWithEventProvider);
