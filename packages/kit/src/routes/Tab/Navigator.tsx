import { useContext, useMemo } from 'react';

import { noop } from 'lodash';

import {
  EPortalContainerConstantName,
  Portal,
  Stack,
  TabStackNavigator,
} from '@onekeyhq/components';
import { TabFreezeOnBlurContext } from '@onekeyhq/kit/src/provider/Container/TabFreezeOnBlurContainer';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { useRouteIsFocused } from '../../hooks/useRouteIsFocused';

import { tabExtraConfig, useTabRouterConfig } from './router';

// prevent pushModal from using unreleased Navigation instances during iOS modal animation by temporary exclusion,
const useIsIOSTabNavigatorFocused =
  platformEnv.isNativeIOS && !platformEnv.isNativeIOSPad
    ? () => {
        const isFocused = useRouteIsFocused();
        return isFocused;
      }
    : () => true;

export function TabNavigator() {
  const { freezeOnBlur } = useContext(TabFreezeOnBlurContext);
  const routerConfigParams = useMemo(() => ({ freezeOnBlur }), [freezeOnBlur]);
  const config = useTabRouterConfig(routerConfigParams);
  const isShowWebTabBar = platformEnv.isDesktop || platformEnv.isNativeIOS;
  const isFocused = useIsIOSTabNavigatorFocused();
  return (
    <>
      <TabStackNavigator<ETabRoutes>
        config={config}
        extraConfig={isShowWebTabBar ? tabExtraConfig : undefined}
      />
      <Portal.Container
        name={EPortalContainerConstantName.IN_PAGE_TAB_CONTAINER}
      />
      {!isFocused ? (
        <Stack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          onPress={noop}
        />
      ) : null}
    </>
  );
}
