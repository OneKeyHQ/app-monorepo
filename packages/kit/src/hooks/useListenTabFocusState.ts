import { rootNavigationRef, useOnRouterChange } from '@onekeyhq/components';

import { ERootRoutes } from '../routes/enum';

export default function useListenTabFocusState(
  tabName: string,
  callback: (isFocus: boolean) => void,
) {
  useOnRouterChange(() => {
    const rootState = rootNavigationRef.current
      ?.getState()
      .routes.find(({ name }) => name === ERootRoutes.Main)?.state;
    const currentTabName = rootState?.routeNames
      ? rootState?.routeNames?.[rootState?.index || 0]
      : rootState?.routes[0].name;
    callback(currentTabName === tabName);
  });
}
