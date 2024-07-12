import type { PropsWithChildren } from 'react';
import { memo, useEffect, useRef } from 'react';

import {
  NavigationContainer as NavigationContainerComponent,
  RouterEventProvider,
} from '@onekeyhq/components';
import { RootNavigator } from '@onekeyhq/kit/src/routes';
import { setAttributes } from '@onekeyhq/shared/src/crashlytics';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useRouterConfig } from '../../routes/config';

import { TabFreezeOnBlurContainer } from './TabFreezeOnBlurContainer';

function BasicNavigation({ children }: PropsWithChildren) {
  const { containerProps, routerConfig } = useRouterConfig();
  useEffect(() => {
    setTimeout(async () => {
      const instanceId =
        await backgroundApiProxy.serviceSetting.getInstanceId();
      setAttributes({
        instanceId,
        platform: platformEnv.symbol || '',
        appChannel: platformEnv.appChannel || '',
      });
    }, 0);
  }, []);
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
