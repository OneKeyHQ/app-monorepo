import { useOnRouterChange } from '@onekeyhq/components';
import { analytics } from '@onekeyhq/shared/src/analytics';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ETabHomeRoutes } from '@onekeyhq/shared/src/routes';

import type { NavigationState, PartialState } from '@react-navigation/routers';

type IState = NavigationState | Omit<PartialState<NavigationState>, 'stale'>;

const getActiveRoute = (state: IState): { name: string; params?: object } => {
  const index = state?.index;
  const route =
    typeof index === 'number'
      ? state?.routes?.[index]
      : state?.routes[state.routes.length - 1];

  if (route?.state) {
    return getActiveRoute(route.state);
  }

  return route;
};

export default function PageTrackerContainer() {
  useOnRouterChange((state) => {
    try {
      if (state === undefined) {
        defaultLogger.app.page.pageView(ETabHomeRoutes.TabHome);
      } else {
        const page = getActiveRoute(state as IState);
        if (page) {
          defaultLogger.app.page.pageView(page.name);
        }
      }
    } catch (error) {
      console.error('useOnRouterChange error', error);
    }
  });
  return null;
}
