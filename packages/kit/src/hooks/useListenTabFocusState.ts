import { useOnRouterChange } from '@onekeyhq/components';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';

import type { ETabRoutes } from '../routes/Tab/type';

export default function useListenTabFocusState(
  tabName: ETabRoutes | ETabRoutes[],
  callback: (isFocus: boolean, isHideByModal: boolean) => void,
) {
  const tabNames = Array.isArray(tabName) ? tabName : [tabName];
  useOnRouterChange((state) => {
    const rootState = state?.routes.find(
      ({ name }) => name === ERootRoutes.Main,
    )?.state;
    const modalRoutes = state?.routes.find(
      ({ name }) => name === ERootRoutes.Modal,
    )?.state;
    const fullModalRoutes = state?.routes.find(
      ({ name }) => name === ERootRoutes.iOSFullScreen,
    )?.state;
    const currentTabName = rootState?.routeNames
      ? (rootState?.routeNames?.[rootState?.index || 0] as ETabRoutes)
      : (rootState?.routes[0].name as ETabRoutes);
    callback(
      tabNames.includes(currentTabName),
      !!(modalRoutes || fullModalRoutes),
    );
  });
}
