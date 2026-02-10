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
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[LANDING_DEBUG] BasicNavigation render, +${(performance.now() - ((globalThis as any).$$debugT0 ?? 0)).toFixed(1)}ms`,
    );
  }
  const { containerProps, routerConfig } = useRouterConfig();
  return useMemo(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[LANDING_DEBUG] BasicNavigation useMemo, +${(performance.now() - ((globalThis as any).$$debugT0 ?? 0)).toFixed(1)}ms`,
      );
    }
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
