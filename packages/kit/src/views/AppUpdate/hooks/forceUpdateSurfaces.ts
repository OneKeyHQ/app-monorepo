import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';

export type IMountedForceUpdateListener = {
  isForceUpdate: boolean;
  downloadHandoffId?: string;
  onRemoteResponse: (response: IAppUpdateInfo) => void;
  onContactSupport: () => void;
};

export const mountedForceUpdateListeners =
  new Set<IMountedForceUpdateListener>();

export function isForceUpdateUiActive() {
  return Array.from(mountedForceUpdateListeners).some(
    (listener) => listener.isForceUpdate,
  );
}
