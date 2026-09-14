import { useCallback, useRef } from 'react';

import { useOnRouterChange } from '@onekeyhq/components';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

const ALL_TAB_ROUTES = Object.values(ETabRoutes);

export default function useListenTabFocusState(
  tabName: ETabRoutes | ETabRoutes[],
  callback: (
    isFocus: boolean,
    isHideByModal: boolean,
    currentTabName: ETabRoutes | undefined,
  ) => void, // do NOT useCallback to wrap the callback
) {
  const tabNames = Array.isArray(tabName) ? tabName : [tabName];
  useOnRouterChange((state) => {
    // the state may be undefined when initializing the interface on the Ext.
    if (!state) {
      callback(tabNames.includes(ETabRoutes.Home), false, ETabRoutes.Home);
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
    const fullScreenPushRoutes = state?.routes.find(
      ({ name }) => name === ERootRoutes.FullScreenPush,
    )?.key;
    const currentTabName = rootState?.routeNames
      ? (rootState?.routeNames?.[rootState?.index || 0] as ETabRoutes)
      : (rootState?.routes[0]?.name as ETabRoutes | undefined);
    callback(
      !!currentTabName && tabNames.includes(currentTabName),
      !!(modalRoutes || fullModalRoutes || fullScreenPushRoutes),
      currentTabName,
    );
  });
}

export function useShortcutsRouteStatus() {
  const shouldReloadAppByCmdR = useRef(true);
  const isAtBrowserTab = useRef(false);
  const isAtPerpTab = useRef(false);
  const isAtDiscoveryTab = useRef(false);
  const currentTabRoute = useRef<ETabRoutes | undefined>(undefined);

  const updateShouldReloadAppByCmdR = useCallback(() => {
    shouldReloadAppByCmdR.current =
      !isAtBrowserTab.current && !isAtPerpTab.current;
  }, []);

  useListenTabFocusState(
    ETabRoutes.MultiTabBrowser,
    (isFocus, isHideByModal) => {
      isAtBrowserTab.current = !isHideByModal && isFocus;
      updateShouldReloadAppByCmdR();
    },
  );

  useListenTabFocusState(
    ETabRoutes.WebviewPerpTrade,
    (isFocus, isHideByModal) => {
      isAtPerpTab.current = !isHideByModal && isFocus;
      updateShouldReloadAppByCmdR();
    },
  );

  useListenTabFocusState(ETabRoutes.Discovery, (isFocus) => {
    isAtDiscoveryTab.current = isFocus;
    updateShouldReloadAppByCmdR();
  });

  useListenTabFocusState(
    ALL_TAB_ROUTES,
    (_isFocus, _isHideByModal, currentTabName) => {
      currentTabRoute.current = currentTabName;
    },
  );

  return {
    currentTabRoute,
    isAtDiscoveryTab,
    isAtBrowserTab,
    isAtPerpTab,
    shouldReloadAppByCmdR,
  };
}
