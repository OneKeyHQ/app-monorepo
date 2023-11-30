import { RootModalNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';

import { iOSFullScreenRouter } from './router';

import type { EIOSFullScreenModalRoutes } from './type';

export function iOSFullScreenNavigator() {
  return (
    <RootModalNavigator<EIOSFullScreenModalRoutes>
      config={iOSFullScreenRouter}
    />
  );
}
