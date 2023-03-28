import type { TabRoutes } from '@onekeyhq/kit/src/routes/routesEnum';

import { Box } from '../index';

import { MobileTabBarInline } from './NavigationBar/MobileTabBar';

export function withTabLayout(
  WrappedComponent: any,
  name: TabRoutes,
): () => JSX.Element {
  return function TabLayoutWrapper() {
    return (
      <Box flex={1}>
        <Box flex={1}>
          {/* @ts-ignore */}
          <WrappedComponent />
        </Box>
        <MobileTabBarInline name={name} />
      </Box>
    );
  };
}
