import type { PropsWithChildren } from 'react';
import { memo, useMemo, useRef } from 'react';

import {
  NavigationContainer as NavigationContainerComponent,
  RouterEventProvider,
} from '@onekeyhq/components';
import { RootNavigator } from '@onekeyhq/kit/src/routes';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';

import { useRouterConfig } from '../../routes/config';

import { TabFreezeOnBlurContainer } from './TabFreezeOnBlurContainer';

type INavigationProps = PropsWithChildren<{
  seedColdStartOnboarding?: boolean;
}>;

function BasicNavigation({
  children,
  seedColdStartOnboarding,
}: INavigationProps) {
  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog('BasicNavigation render');
  }
  const { containerProps, routerConfig } = useRouterConfig(
    seedColdStartOnboarding,
  );
  return useMemo(() => {
    if (process.env.NODE_ENV !== 'production') {
      debugLandingLog('BasicNavigation useMemo');
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

function NavigationWithEventProvider(props: INavigationProps) {
  const routerEventRef = useRef([]);
  return (
    <RouterEventProvider value={routerEventRef}>
      <MemoizedBasicNavigation {...props} />
    </RouterEventProvider>
  );
}

export const NavigationContainer = memo(NavigationWithEventProvider);
