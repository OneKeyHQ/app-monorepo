import { rootNavigationRef } from '@onekeyhq/components';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
import {
  EAppUpdateRoutes,
  EModalRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';

export type IMountedForceUpdateListener = {
  isForceUpdate: boolean;
  routeKey?: string;
  supportHandoffId?: string;
  downloadHandoffId?: string;
  onRemoteResponse: (response: IAppUpdateInfo) => void;
  onContactSupport: () => void;
};

export const mountedForceUpdateListeners =
  new Set<IMountedForceUpdateListener>();

type IForceUpdateRoute = {
  key?: string;
  name: string;
  params?: unknown;
  state?: {
    index?: number;
    routes: readonly IForceUpdateRoute[];
  };
};

function getActiveRoute(state: IForceUpdateRoute['state']) {
  return state?.routes[state.index ?? 0];
}

function getRequestedRoute(params: unknown): IForceUpdateRoute | undefined {
  const target = params as { screen?: string; params?: unknown } | undefined;
  return target?.screen
    ? { name: target.screen, params: target.params }
    : undefined;
}

function isPendingForceUpdateRoute(root: IForceUpdateRoute) {
  if (
    root.name !== ERootRoutes.Modal &&
    root.name !== ERootRoutes.iOSFullScreen
  ) {
    return false;
  }
  const modal = root.state
    ? getActiveRoute(root.state)
    : getRequestedRoute(root.params);
  if (modal?.name !== EModalRoutes.AppUpdateModal) return false;
  const page = modal.state
    ? getActiveRoute(modal.state)
    : getRequestedRoute(modal.params);
  if (
    page?.name !== EAppUpdateRoutes.UpdatePreview &&
    page?.name !== EAppUpdateRoutes.DownloadVerify
  ) {
    return false;
  }

  // A dispatched lazy screen can be reset before its first layout effect.
  // Once it registers, its live whitelist result owns the decision.
  return (
    (page.params as { isForceUpdate?: boolean } | undefined)?.isForceUpdate ===
      true &&
    !Array.from(mountedForceUpdateListeners).some(
      (listener) => page.key && listener.routeKey === page.key,
    )
  );
}

export function isForceUpdateUiActive() {
  return (
    Array.from(mountedForceUpdateListeners).some(
      (listener) => listener.isForceUpdate,
    ) ||
    (rootNavigationRef?.current
      ?.getRootState()
      ?.routes.some(isPendingForceUpdateRoute) ??
      false)
  );
}
