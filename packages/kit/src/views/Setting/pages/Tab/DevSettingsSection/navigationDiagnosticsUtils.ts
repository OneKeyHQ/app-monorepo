import { ERootRoutes } from '@onekeyhq/shared/src/routes';

export type INavigationStateLike = {
  key?: string;
  index?: number;
  routeNames?: string[];
  routes?: Array<{
    key?: string;
    name?: string;
    state?: INavigationStateLike;
  }>;
};

export type IMainRouteMatch = {
  key?: string;
  tabRouteNames: string[];
  activeTabRouteName?: string;
};

export type IMainRouteInspection = {
  hasTwoOrMoreMainRoutes: boolean;
  mainRouteCount: number;
  mainRoutes: IMainRouteMatch[];
};

function getSafeRouteIndex(index: number | undefined, length: number) {
  if (length <= 0) {
    return 0;
  }
  if (typeof index !== 'number' || index < 0 || index >= length) {
    return 0;
  }
  return index;
}

function getRouteNames(state: INavigationStateLike | undefined) {
  if (state?.routeNames?.length) {
    return state.routeNames;
  }
  return (state?.routes ?? [])
    .map((route) => route.name)
    .filter((routeName): routeName is string => Boolean(routeName));
}

function getActiveRouteName(state: INavigationStateLike | undefined) {
  const routes = state?.routes ?? [];
  const routeIndex = getSafeRouteIndex(state?.index, routes.length);
  return routes[routeIndex]?.name;
}

export function inspectMainRoutes(
  state: INavigationStateLike | undefined,
): IMainRouteInspection {
  const mainRoutes = (state?.routes ?? [])
    .filter((route) => route.name === ERootRoutes.Main)
    .map((route) => ({
      key: route.key,
      tabRouteNames: getRouteNames(route.state),
      activeTabRouteName: getActiveRouteName(route.state),
    }));

  return {
    hasTwoOrMoreMainRoutes: mainRoutes.length >= 2,
    mainRouteCount: mainRoutes.length,
    mainRoutes,
  };
}
