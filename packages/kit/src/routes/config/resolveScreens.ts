import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { IScreenPathConfig } from '@onekeyhq/shared/src/utils/routeUtils';

export interface IScreenRouterConfig {
  name: string;
  rewrite?: string;
  exact?: boolean;
  children?: readonly IScreenRouterConfig[] | null;
}

const tabRouteNames: ReadonlySet<string> = new Set(Object.values(ETabRoutes));

export const resolveScreens = (
  routes: readonly IScreenRouterConfig[],
): IScreenPathConfig | undefined =>
  routes
    ? routes.reduce((prev, route) => {
        prev[route.name] = {
          path: route.rewrite ? route.rewrite : route.name,
          exact: !!route.exact,
        };
        const config = Array.isArray(route.children)
          ? route.children
          : undefined;
        if (config) {
          prev[route.name].screens = resolveScreens(config);
          if (config.length > 0 && tabRouteNames.has(route.name)) {
            prev[route.name].initialRouteName = config[0].name;
          }
        }

        return prev;
      }, {} as IScreenPathConfig)
    : undefined;
