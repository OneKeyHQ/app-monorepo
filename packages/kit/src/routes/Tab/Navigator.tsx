import { TabStackNavigator } from '@onekeyhq/components';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { tabExtraConfig, tabRouter } from './router';

export function TabNavigator() {
  return (
    <TabStackNavigator<ETabRoutes>
      config={tabRouter}
      extraConfig={tabExtraConfig}
    />
  );
}
