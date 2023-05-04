import { useAppSelector } from '../hooks';
import { ModalRoutes, RootRoutes, TabRoutes } from '../routes/routesEnum';

import type { WalletHomeTabEnum } from '../views/Wallet/type';

export function getCurrentModalRouteData() {
  const modalRoute = global.$navigationRef.current
    ?.getState()
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

export function getRootTabRouteState() {
  return global?.$navigationRef?.current?.getState?.()?.routes?.[0]?.state
    ?.routes?.[0]?.state;
}

export function isAtAppRootTab(appRootTabName: TabRoutes) {
  const tabRouteState = getRootTabRouteState();
  if (tabRouteState && appRootTabName) {
    const tabIndex = tabRouteState?.routes?.findIndex?.(
      (item) => item.name === appRootTabName,
    );
    if (tabIndex === tabRouteState?.index) {
      return true;
    }
  }
  return false;
}

export const isAtMarketTab = () => isAtAppRootTab(TabRoutes.Market);

export const isAtSwapTab = () => isAtAppRootTab(TabRoutes.Swap);

export function useIsAtHomeTab(homeTabName: WalletHomeTabEnum) {
  const currentHomeTabName = useAppSelector((s) => s.status.homeTabName);
  return currentHomeTabName === homeTabName;
}

// @ts-ignore
global.$$isAtAppRootTab = isAtAppRootTab;
