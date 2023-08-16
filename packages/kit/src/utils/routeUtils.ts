import { useHomeTabName } from '../hooks/useHomeTabName';
import { ModalRoutes, RootRoutes } from '../routes/routesEnum';

import type { TabRoutes } from '../routes/routesEnum';
import type { WalletHomeTabEnum } from '../views/Wallet/type';

function getAppRootTabInfo() {
  return global?.$navigationRef?.current?.getRootState?.()?.routes?.[0]?.state
    ?.routes?.[0]?.state;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getAllAppRootTabRoutes() {
  return getAppRootTabInfo()?.routes;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getCurrentAppRootTabIndex() {
  return getAppRootTabInfo()?.index;
}

function getCurrentAppRootTabInfo() {
  const info = getAppRootTabInfo();
  if (info && info.index !== undefined) {
    return info.routes[info.index];
  }
  return undefined;
}

export function getCurrentModalRouteData() {
  const modalRoute = global?.$navigationRef?.current
    ?.getRootState()
    ?.routes?.find((item) => item?.name === RootRoutes.Modal);

  if (modalRoute) {
    const params = modalRoute?.params as
      | {
          screen?: ModalRoutes;
          params?: any;
        }
      | undefined;
    return { ...modalRoute, params };
  }
  return undefined;
}

export function isModalRouteExisting() {
  return Boolean(getCurrentModalRouteData()?.key);
}

export function isSendModalRouteExisting() {
  const currentRoute = getCurrentModalRouteData();
  const existing = currentRoute?.params?.screen === ModalRoutes.Send;
  return existing;
}

// TODO remove
export function getRootRoute() {
  return global?.$navigationRef?.current?.getState?.()?.routes?.[0];
}

export function getRootTabRoute() {
  return getRootRoute()?.state?.routes?.[0];
}

export function getRootTabRouteState() {
  return getRootTabRoute()?.state;
}
export function getAppRootTabInfoOfTab(appRootTabName: TabRoutes) {
  const info = getAppRootTabInfo();
  if (info && info.routes) {
    // @ts-ignore
    return info.routes.find(
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (item) => item.name === appRootTabName,
    ) as typeof info.routes[0];
  }
  return undefined;
}

export function getCurrentAppRootTabStackRoutes() {
  const info = getCurrentAppRootTabInfo();
  return info?.state?.routes;
}

export function isAtAppRootTab(appRootTabName: TabRoutes) {
  const info = getCurrentAppRootTabInfo();
  if (info && info.name && appRootTabName) {
    return info.name === appRootTabName;
  }
  return false;
}

export function useIsAtHomeTab(homeTabName: WalletHomeTabEnum) {
  const currentHomeTabName = useHomeTabName();
  return currentHomeTabName === homeTabName;
}

// @ts-ignore
global.$$isAtAppRootTab = isAtAppRootTab;
// @ts-ignore
global.$$getCurrentAppRootTabStackRoutes = getCurrentAppRootTabStackRoutes;
// @ts-ignore
global.$$getCurrentModalRouteData = getCurrentModalRouteData;
// @ts-ignore
global.$$getAppRootTabInfoOfTab = getAppRootTabInfoOfTab;
