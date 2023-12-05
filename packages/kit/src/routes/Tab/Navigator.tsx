import { TabStackNavigator } from '@onekeyhq/components';

import { tabExtraConfig, tabRouter } from './router';

import type { ETabRoutes } from './type';

export function TabNavigator() {
  return (
    <TabStackNavigator<ETabRoutes>
      config={tabRouter}
      extraConfig={tabExtraConfig}
    />
  );
}
