import type { TabRoutes } from '@onekeyhq/kit/src/routes/routesEnum';

import { Box } from '../index';

import { MobileBottomTabBarInline } from './NavigationBar/MobileBottomTabBar';

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
        <MobileBottomTabBarInline name={name} />
      </Box>
    );
  };
}
