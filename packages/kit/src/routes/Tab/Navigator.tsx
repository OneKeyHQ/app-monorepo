import { useContext, useMemo } from 'react';

import { TabStackNavigator } from '@onekeyhq/components';
import { TabFreezeOnBlurContext } from '@onekeyhq/kit/src/provider/Container/TabFreezeOnBlurContainer';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { tabExtraConfig, useTabRouterConfig } from './router';

export function TabNavigator() {
  const { freezeOnBlur } = useContext(TabFreezeOnBlurContext);
  const routerConfigParams = useMemo(() => ({ freezeOnBlur }), [freezeOnBlur]);
  const config = useTabRouterConfig(routerConfigParams);
  const isShowWebTabBar = platformEnv.isDesktop || platformEnv.isNativeIOS;
  return (
    <TabStackNavigator<ETabRoutes>
      config={config}
      extraConfig={isShowWebTabBar ? tabExtraConfig : undefined}
    />
  );
}
