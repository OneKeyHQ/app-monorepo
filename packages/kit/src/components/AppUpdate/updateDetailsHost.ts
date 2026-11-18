import {
  isBlockingLevel,
  overlayStore,
} from '@onekeyfe/react-native-native-overlay';

import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';

// Desktop UI and background business code share this renderer runtime.
const hosts = new Set<(target: IAppUpdateInfo) => boolean>();

export function registerUpdateDetailsHost(
  host: (target: IAppUpdateInfo) => boolean,
) {
  hosts.add(host);
  return () => {
    hosts.delete(host);
  };
}

export function tryOpenUpdateDetails(target: IAppUpdateInfo) {
  for (const host of hosts) {
    if (host(target)) return true;
  }
  return false;
}

export function hasBlockingUpdateOverlay(protectedOnly = false) {
  return overlayStore
    .getSnapshot()
    .entries.some(
      (entry) =>
        entry.blocking &&
        !entry.suspended &&
        isBlockingLevel(entry.level) &&
        (!protectedOnly || entry.level !== 'modal'),
    );
}
