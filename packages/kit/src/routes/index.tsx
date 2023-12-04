import { RootStackNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';

import { rootRouter } from './router';

import type { ERootRoutes } from './enum';

export function RootNavigator() {
  return <RootStackNavigator<ERootRoutes, any> config={rootRouter} />;
}
