import { useOnRouterChange } from '@onekeyhq/components';

import { ERootRoutes } from '../routes/enum';

import type { ETabRoutes } from '../routes/Tab/type';

export default function useListenTabFocusState(
  tabName: ETabRoutes | ETabRoutes[],
  callback: (isFocus: boolean) => void,
) {
  const tabNames = Array.isArray(tabName) ? tabName : [tabName];
  useOnRouterChange((state) => {
    const rootState = state?.routes.find(
      ({ name }) => name === ERootRoutes.Main,
    )?.state;
    const currentTabName = rootState?.routeNames
      ? (rootState?.routeNames?.[rootState?.index || 0] as ETabRoutes)
      : (rootState?.routes[0].name as ETabRoutes);
    callback(tabNames.includes(currentTabName));
  });
}
