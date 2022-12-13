import { ModalRoutes, RootRoutes } from '../routes/routesEnum';

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
    ?.routes?.[0]?.state?.routes?.[0]?.state;
}
