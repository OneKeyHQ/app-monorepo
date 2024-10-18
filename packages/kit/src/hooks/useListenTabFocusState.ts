import { useOnRouterChange } from '@onekeyhq/components';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

export default function useListenTabFocusState(
  tabName: ETabRoutes | ETabRoutes[],
  callback: (isFocus: boolean, isHideByModal: boolean) => void,
) {
  const tabNames = Array.isArray(tabName) ? tabName : [tabName];
  useOnRouterChange((state) => {
    // the state may be undefined when initializing the interface on the Ext.
    if (!state) {
      callback(tabName === ETabRoutes.Home, false);
      return;
    }
    const rootState = state?.routes.find(
      ({ name }) => name === ERootRoutes.Main,
    )?.state;
    const modalRoutes = state?.routes.find(
      ({ name }) => name === ERootRoutes.Modal,
    )?.key;
    const fullModalRoutes = state?.routes.find(
      ({ name }) => name === ERootRoutes.iOSFullScreen,
    )?.key;
    const currentTabName = rootState?.routeNames
      ? (rootState?.routeNames?.[rootState?.index || 0] as ETabRoutes)
      : (rootState?.routes[0].name as ETabRoutes);
    callback(
      tabNames.includes(currentTabName),
      !!(modalRoutes || fullModalRoutes),
    );
  });
}
