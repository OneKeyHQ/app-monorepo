import { useEffect } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getAppNavigation } from '../hooks/useAppNavigation';
import { parseQuerystring, parseUrlObject } from '../utils/uriUtils';
import { IS_LAZY_NAVIGATE_SUB_ROUTER } from '../views/Send/sendConfirmConsts';

export function buildModalRouteParams({
  screens = [],
  routeParams,
}: {
  screens: string[];
  routeParams: Record<string, any>;
}) {
  const modalParams: { screen: any; params: any } = {
    screen: null,
    params: {},
  };
  let paramsCurrent = modalParams;
  let paramsLast = modalParams;
  screens.forEach((screen) => {
    paramsCurrent.screen = screen;
    paramsCurrent.params = {};
    paramsLast = paramsCurrent;
    paramsCurrent = paramsCurrent.params;
  });
  paramsLast.params = routeParams;
  return modalParams;
}

export function useAutoNavigateOnMount() {
  useEffect(() => {
    setTimeout(() => {
      if (!platformEnv.isExtensionUiStandaloneWindow) {
        return;
      }
      if (!IS_LAZY_NAVIGATE_SUB_ROUTER) {
        return;
      }
      try {
        const uriInfo = parseUrlObject(window.location.href);
        const routerHash = uriInfo.searchParams.get('navigateRouterHash');
        if (routerHash) {
          const mockUrl = `https://helloworld.com/${routerHash.replace(
            '#/',
            '',
          )}`;
          const mockUrlInfo = parseUrlObject(mockUrl);
          const { pathname, search } = mockUrlInfo;
          const queryInfo = parseQuerystring(search.replace('?', ''));
          const pathList = pathname.split('/').filter(Boolean);
          const routeParams = buildModalRouteParams({
            screens: pathList,
            routeParams: queryInfo,
          });
          const navigation = getAppNavigation();
          navigation.navigate(routeParams.screen, routeParams.params);
        }
      } catch (error) {
        console.error(error);
      }
    }, 300);
  }, []);
}
