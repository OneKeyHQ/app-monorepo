import { useContext, useMemo } from 'react';

import { TabStackNavigator, useMedia } from '@onekeyhq/components';
import { TabFreezeOnBlurContext } from '@onekeyhq/kit/src/provider/Container/TabFreezeOnBlurContainer';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { tabExtraConfig, useTabRouterConfig } from './router';

export function TabNavigator() {
  const { freezeOnBlur } = useContext(TabFreezeOnBlurContext);
  const routerConfigParams = useMemo(() => ({ freezeOnBlur }), [freezeOnBlur]);
  const config = useTabRouterConfig(routerConfigParams);
  const { gtMd } = useMedia();
  const isShowWebTabBar =
    platformEnv.isDesktop || (platformEnv.isNative && gtMd);
  return (
    <TabStackNavigator<ETabRoutes>
      config={config}
      extraConfig={isShowWebTabBar ? tabExtraConfig : undefined}
    />
  );
}
