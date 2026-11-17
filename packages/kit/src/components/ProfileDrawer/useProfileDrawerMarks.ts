import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import {
  useFirmwareUpdatesDetectStatusPersistAtom,
  useNotificationsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAppUpdateStatus } from '@onekeyhq/shared/src/appUpdate';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  useIntercomUnreadCount,
  useIsIntercomUnreadCountKnown,
} from '../../hooks/useIntercomUnreadCount';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { isShowAppUpdateUIWhenUpdating, useAppUpdateInfo } from '../AppUpdate';

import {
  computeProfileDrawerMarks,
  firmwareUpdateKey,
  parseProfileDrawerSeen,
  seenOnOpen,
  settleSeen,
} from './profileDrawerMarks';
import { useIsProfileDrawerOpen } from './profileDrawerStore';

import type {
  IProfileDrawerAppUpdate,
  IProfileDrawerSeen,
  IProfileDrawerSignals,
} from './profileDrawerMarks';

const APP_UPDATE_IN_PROGRESS = new Set([
  EAppUpdateStatus.downloadPackage,
  EAppUpdateStatus.downloadASC,
  EAppUpdateStatus.verifyASC,
  EAppUpdateStatus.verifyPackage,
]);
const APP_UPDATE_FAILED = new Set([
  EAppUpdateStatus.downloadPackageFailed,
  EAppUpdateStatus.downloadASCFailed,
  EAppUpdateStatus.verifyASCFailed,
  EAppUpdateStatus.verifyPackageFailed,
  EAppUpdateStatus.failed,
]);

// UI-only and read on every render, so it stays in sync storage with an
// in-memory copy.
let seenCache: IProfileDrawerSeen | undefined;
const seenListeners = new Set<() => void>();

function getSeen() {
  if (!seenCache) {
    seenCache = parseProfileDrawerSeen(
      appStorage.syncStorage.getString(
        EAppSyncStorageKeys.onekey_profile_drawer_seen_v1,
      ),
    );
  }
  return seenCache;
}

function setSeen(next: IProfileDrawerSeen) {
  const current = getSeen();
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  seenCache = next;
  void appStorage.syncStorage.set(
    EAppSyncStorageKeys.onekey_profile_drawer_seen_v1,
    JSON.stringify(next),
  );
  seenListeners.forEach((listener) => listener());
}

function subscribeSeen(listener: () => void) {
  seenListeners.add(listener);
  return () => {
    seenListeners.delete(listener);
  };
}

// Every device with a firmware update, not only the current account's.
function useFirmwareUpdateKeys(isTravelMode: boolean) {
  const [detectStatus] = useFirmwareUpdatesDetectStatusPersistAtom();
  // Drops devices removed since their last check.
  const { result: connectIds } = usePromiseResult(
    async () => {
      // Nothing to filter until a device has been checked. Travel mode
      // rejects the device list, and hides firmware marks anyway.
      if (!detectStatus || isTravelMode) return [];
      // The same list "My devices" shows (an exposed background method).
      const wallets =
        await backgroundApiProxy.serviceAccount.getAllHwQrWalletWithDevice({
          filterHiddenWallet: true,
        });
      return Object.values(wallets).flatMap((item) =>
        item.device?.connectId ? [item.device.connectId] : [],
      );
    },
    [detectStatus, isTravelMode],
    { checkIsFocused: false },
  );
  return useMemo(() => {
    if (!detectStatus || !connectIds) return [];
    const known = new Set(connectIds);
    return Object.values(detectStatus)
      .filter((status) => status?.hasUpgrade && known.has(status.connectId))
      .map((status) =>
        firmwareUpdateKey({
          connectId: status?.connectId ?? '',
          toVersion: status?.toVersion,
          toVersionBle: status?.toVersionBle,
        }),
      )
      .toSorted();
  }, [connectIds, detectStatus]);
}

// trackSeen: the always-mounted avatar records what the user has seen each
// time the drawer is open, so only one caller writes.
export function useProfileDrawerMarks({
  trackSeen = false,
}: { trackSeen?: boolean } = {}) {
  const [{ firstTimeGuideOpened, badge }] = useNotificationsAtom();
  const unreadSupport = useIntercomUnreadCount();
  const supportKnown = useIsIntercomUnreadCountKnown();
  const appUpdateInfo = useAppUpdateInfo();
  // Same rule as the dot on Settings > About OneKey; the label follows the
  // download so a failure doesn't read as a fresh offer.
  const appUpdateShown =
    appUpdateInfo.isNeedUpdate &&
    isShowAppUpdateUIWhenUpdating({
      updateStrategy: appUpdateInfo.data.updateStrategy,
      updateStatus: appUpdateInfo.data.status,
    });
  let appUpdate: IProfileDrawerAppUpdate | undefined;
  if (appUpdateShown) {
    const { status } = appUpdateInfo.data;
    if (APP_UPDATE_FAILED.has(status)) appUpdate = 'failed';
    else if (APP_UPDATE_IN_PROGRESS.has(status)) appUpdate = 'updating';
    else appUpdate = 'available';
  }
  const isTravelMode =
    travelModeManager.getRuntimeEnvironmentSync().profile.kind ===
    'travel-mode';
  const firmwareUpdateKeys = useFirmwareUpdateKeys(isTravelMode);
  const isOpen = useIsProfileDrawerOpen();
  const seen = useSyncExternalStore(subscribeSeen, getSeen, getSeen);

  const signals = useMemo<IProfileDrawerSignals>(
    () => ({
      isTravelMode,
      notificationGuideOpened: !!firstTimeGuideOpened,
      unreadNotifications: badge ?? 0,
      unreadSupport,
      notificationsKnown: badge !== undefined,
      supportKnown,
      appUpdate,
      firmwareUpdateKeys,
    }),
    [
      appUpdate,
      badge,
      firmwareUpdateKeys,
      firstTimeGuideOpened,
      isTravelMode,
      supportKnown,
      unreadSupport,
    ],
  );

  // Rising edge of the drawer opening, so each open reports once.
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!trackSeen) return;
    const opening = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (opening) {
      // What the user saw on the avatar and rows, before it counts as seen.
      const shown = computeProfileDrawerMarks(signals, getSeen());
      defaultLogger.wallet.profileDrawer.profileDrawerOpened({
        avatarReasons: shown.avatarReasons,
        unreadNotifications: !!shown.notifications,
        unreadSupport: shown.support > 0,
        appUpdate: shown.appUpdate ?? 'none',
        firmwareUpdate: shown.firmwareUpdate,
      });
    }
    setSeen(
      isOpen ? seenOnOpen(signals, getSeen()) : settleSeen(signals, getSeen()),
    );
  }, [isOpen, signals, trackSeen]);

  return useMemo(
    () => computeProfileDrawerMarks(signals, seen),
    [seen, signals],
  );
}
