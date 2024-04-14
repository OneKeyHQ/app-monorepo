import { useContext } from 'react';

import { TabStackNavigator } from '@onekeyhq/components';
import { TabFreezeOnBlurContext } from '@onekeyhq/kit/src/provider/Container/TabFreezeOnBlurContainer';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { getTabRouter, tabExtraConfig } from './router';

export function TabNavigator() {
  const { freezeOnBlur } = useContext(TabFreezeOnBlurContext);
  return (
    <TabStackNavigator<ETabRoutes>
      config={getTabRouter({ freezeOnBlur })}
      extraConfig={tabExtraConfig}
    />
  );
}
