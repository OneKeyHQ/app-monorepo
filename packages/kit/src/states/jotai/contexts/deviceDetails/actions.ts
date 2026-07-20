import { EDeviceType } from '@onekeyfe/hd-shared';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import thirdPartyDeviceUtils from '@onekeyhq/shared/src/utils/thirdPartyDeviceUtils';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  contextAtomMethod,
  currentWalletIdAtom,
  deviceMetaStateAtom,
  deviceMetaStaticAtom,
  emptyMetaState,
  emptyMetaStatic,
  pro2DeviceManagementSnapshotAtom,
  refreshSettledAtom,
  walletWithDeviceStateAtom,
} from './atoms';
import {
  buildPro2DeviceMetaState,
  getPro2DeviceMetaStaticOverrides,
  shouldRefreshDeviceSettingsAfterUpdate,
} from './pro2DeviceManagement';

import type { IDeviceMetaState, IDeviceMetaStatic } from './atoms';
import type { IPro2DeviceManagementSnapshot } from './pro2DeviceManagement';

async function buildDeviceMetaStatic(
  walletWithDevice?: IHwQrWalletWithDevice,
  pro2Snapshot?: IPro2DeviceManagementSnapshot,
): Promise<IDeviceMetaStatic | undefined> {
  if (!walletWithDevice?.device?.featuresInfo) {
    return undefined;
  }

  const { device } = walletWithDevice;
  const features = device.featuresInfo;
  if (!features) {
    return undefined;
  }
  const vendorProfile = getVendorProfile(
    device.vendor ?? EHardwareVendor.onekey,
  );
  const isThirdParty = vendorProfile.isThirdParty;

  const versions = isThirdParty
    ? thirdPartyDeviceUtils.getDeviceVersion({
        device,
        features,
      })
    : await deviceUtils.getDeviceVersion({
        device,
        features,
      });
  const deviceType = isThirdParty
    ? device.deviceType
    : await deviceUtils.getDeviceTypeFromFeatures({
        features,
      });
  const firmwareType = isThirdParty
    ? thirdPartyDeviceUtils.getFirmwareType({
        features,
      })
    : await deviceUtils.getFirmwareType({
        features,
      });
  const firmwareTypeLabel = deviceUtils.getFirmwareTypeLabelByFirmwareType({
    firmwareType,
    displayFormat: 'withSpace',
  });
  const pro2Overrides = pro2Snapshot
    ? getPro2DeviceMetaStaticOverrides(pro2Snapshot)
    : undefined;
  const firmwareVersion =
    pro2Overrides?.firmwareVersion ?? versions?.firmwareVersion;
  const firmwareVersionDisplay = firmwareVersion
    ? `${firmwareTypeLabel}v${firmwareVersion}`
    : '-';

  const deviceName = isThirdParty
    ? thirdPartyDeviceUtils.getDeviceName({
        device,
        features,
        defaultDeviceName: vendorProfile.defaultDeviceName,
      })
    : deviceUtils.buildDeviceBleName({
        features,
      });

  return {
    deviceName: pro2Overrides?.deviceName ?? deviceName,
    deviceType,
    firmwareType,
    firmwareVersion: firmwareVersion ?? '0.0.0',
    firmwareVersionDisplay,
    firmwareTypeLabel,
    addWallpaperTitleId: deviceUtils.isTouchDevice(deviceType)
      ? ETranslations.global_wallpaper_add
      : ETranslations.global_wallpaper,
  };
}

async function buildDeviceMetaState(
  walletWithDevice?: IHwQrWalletWithDevice,
  pro2Snapshot?: IPro2DeviceManagementSnapshot,
): Promise<IDeviceMetaState | undefined> {
  if (!walletWithDevice?.device?.featuresInfo) {
    return undefined;
  }

  const { device } = walletWithDevice;
  const features = device.featuresInfo;
  if (!features) {
    return undefined;
  }
  const isVerified = Boolean(device.verifiedAtVersion);
  if (device.deviceType === EDeviceType.Pro2 && pro2Snapshot) {
    return buildPro2DeviceMetaState({
      isVerified,
      snapshot: pro2Snapshot,
    });
  }
  const autoLockDelayMs = features.autoLockDelayMs ?? 0;
  const autoShutDownDelayMs = features.autoLockDelayMs ?? 0;
  const language = features.language ?? undefined;
  const hapticFeedback = false;

  return {
    isVerified,
    unlocked: features.unlocked !== false,
    initialized: features.initialized !== false,
    backupRequired: Boolean(features.backupRequired),
    unlockedByAttachToPin: false,
    passphraseEnabled: Boolean(features?.passphraseProtection),
    pinOnAppEnabled: Boolean(device.settings?.inputPinOnSoftware),
    autoLockDelayMs,
    autoShutDownDelayMs,
    language,
    brightness: undefined,
    hapticFeedback,
    isReady: true,
  };
}

class DeviceDetailsActions extends ContextJotaiActionsBase {
  updateDeviceMetaStatic = contextAtomMethod(
    async (get, set, walletId?: string) => {
      const data = get(walletWithDeviceStateAtom());
      const metaStatic = await buildDeviceMetaStatic(
        data,
        get(pro2DeviceManagementSnapshotAtom()),
      );
      // Superseded by a newer device switch during the await — drop this write.
      if (walletId && get(currentWalletIdAtom()) !== walletId) return;
      if (metaStatic) {
        set(deviceMetaStaticAtom(), metaStatic);
      }
    },
  );

  updateDeviceMetaState = contextAtomMethod(
    async (get, set, walletId?: string) => {
      const data = get(walletWithDeviceStateAtom());
      const metaState = await buildDeviceMetaState(
        data,
        get(pro2DeviceManagementSnapshotAtom()),
      );
      if (walletId && get(currentWalletIdAtom()) !== walletId) return;
      if (metaState) {
        set(deviceMetaStateAtom(), metaState);
      }
    },
  );

  refresh = contextAtomMethod(
    async (
      get,
      set,
      incomingWalletId?: string,
      options?: { refreshPro2Info?: boolean },
    ) => {
      const walletId = incomingWalletId ?? get(currentWalletIdAtom());
      if (!walletId) return;

      // Device switched: reset header state so the skeleton re-engages.
      if (walletId !== get(currentWalletIdAtom())) {
        set(currentWalletIdAtom(), walletId);
        set(walletWithDeviceStateAtom(), undefined);
        set(pro2DeviceManagementSnapshotAtom(), undefined);
        set(deviceMetaStaticAtom(), emptyMetaStatic);
        set(deviceMetaStateAtom(), emptyMetaState);
        set(refreshSettledAtom(), false);
      }

      try {
        const r =
          await backgroundApiProxy.serviceAccount.getAllHwQrWalletWithDevice({
            filterHiddenWallet: true,
          });

        const data = r?.[walletId];
        // Drop a superseded response (device switched mid-flight).
        if (get(currentWalletIdAtom()) !== walletId) {
          return data;
        }
        set(currentWalletIdAtom(), walletId);
        set(walletWithDeviceStateAtom(), data);
        if (
          data?.device?.deviceType === EDeviceType.Pro2 &&
          data.device.connectId
        ) {
          const snapshot = await backgroundApiProxy.serviceHardware
            .getPro2DeviceManagementSnapshot({
              connectId: data.device.connectId,
              refreshInfo: options?.refreshPro2Info,
            })
            .catch(() => undefined);
          if (get(currentWalletIdAtom()) !== walletId) {
            return data;
          }
          set(pro2DeviceManagementSnapshotAtom(), snapshot);
        } else {
          set(pro2DeviceManagementSnapshotAtom(), undefined);
        }
        await this.updateDeviceMetaStatic.call(set, walletId);
        await this.updateDeviceMetaState.call(set, walletId);
        return data;
      } finally {
        // Don't mark settled if a newer refresh already took over.
        if (get(currentWalletIdAtom()) === walletId) {
          set(refreshSettledAtom(), true);
        }
      }
    },
  );

  getCurrentWalletId = contextAtomMethod(async (get) => {
    return get(currentWalletIdAtom());
  });

  getWalletWithDevice = contextAtomMethod(async (get) => {
    return get(walletWithDeviceStateAtom());
  });

  getDeviceMetaStatic = contextAtomMethod(async (get) => {
    return get(deviceMetaStaticAtom());
  });

  getDeviceMetaState = contextAtomMethod(async (get) => {
    return get(deviceMetaStateAtom());
  });

  refreshAfterDeviceSettingUpdate = contextAtomMethod(async (get, set) => {
    const deviceType = get(deviceMetaStaticAtom()).deviceType;
    const unlocked = Boolean(get(deviceMetaStateAtom()).unlocked);
    if (
      shouldRefreshDeviceSettingsAfterUpdate({
        isPro2: deviceType === EDeviceType.Pro2,
        unlocked,
      })
    ) {
      await this.refresh.call(set);
    }
  });

  updateLanguage = contextAtomMethod(async (get, set, value: string) => {
    const walletId = get(currentWalletIdAtom());
    if (!walletId) return;

    await backgroundApiProxy.serviceHardware.setLanguage({
      walletId,
      language: value,
    });
    await this.refreshAfterDeviceSettingUpdate.call(set);
  });

  updateBrightness = contextAtomMethod(async (get, set, value?: number) => {
    const walletId = get(currentWalletIdAtom());
    if (!walletId) return;

    await backgroundApiProxy.serviceHardware.setBrightness({
      walletId,
      brightness: value,
    });
    if (typeof value === 'number') {
      await this.refreshAfterDeviceSettingUpdate.call(set);
    }
  });

  updateHapticFeedback = contextAtomMethod(async (get, set, value: boolean) => {
    const walletId = get(currentWalletIdAtom());
    if (!walletId) return;

    await backgroundApiProxy.serviceHardware.setHapticFeedback({
      walletId,
      hapticFeedback: value,
    });
    await this.refreshAfterDeviceSettingUpdate.call(set);
  });

  updateAutoLockDelayMs = contextAtomMethod(async (get, set, value: number) => {
    const walletId = get(currentWalletIdAtom());
    if (!walletId) return;

    await backgroundApiProxy.serviceHardware.setAutoLockDelayMs({
      walletId,
      autoLockDelayMs: value,
    });
    await this.refreshAfterDeviceSettingUpdate.call(set);
  });

  updateAutoShutDownDelayMs = contextAtomMethod(
    async (get, set, value: number) => {
      const walletId = get(currentWalletIdAtom());
      if (!walletId) return;

      await backgroundApiProxy.serviceHardware.setAutoShutDownDelayMs({
        walletId,
        autoShutdownDelayMs: value,
      });
      await this.refreshAfterDeviceSettingUpdate.call(set);
    },
  );

  updatePassphraseEnabled = contextAtomMethod(
    async (get, set, value: boolean) => {
      const walletId = get(currentWalletIdAtom());
      if (!walletId) return;

      await backgroundApiProxy.serviceHardware.setPassphraseEnabled({
        walletId,
        passphraseEnabled: value,
      });
      await this.refresh.call(set);
    },
  );

  updateInputPinOnSoftware = contextAtomMethod(
    async (get, set, value: boolean) => {
      const walletId = get(currentWalletIdAtom());
      if (!walletId) return;

      await backgroundApiProxy.serviceHardware.setInputPinOnSoftware({
        walletId,
        inputPinOnSoftware: value,
      });
      await this.refresh.call(set);
    },
  );
}

const createActions = memoFn(() => new DeviceDetailsActions());

export function useDeviceDetailsActions() {
  const actions = createActions();
  const refresh = actions.refresh.use();
  const updateDeviceMetaState = actions.updateDeviceMetaState.use();
  const getWalletWithDevice = actions.getWalletWithDevice.use();
  const getDeviceMetaStatic = actions.getDeviceMetaStatic.use();
  const getDeviceMetaState = actions.getDeviceMetaState.use();
  const getCurrentWalletId = actions.getCurrentWalletId.use();
  const updateLanguage = actions.updateLanguage.use();
  const updateBrightness = actions.updateBrightness.use();
  const updateHapticFeedback = actions.updateHapticFeedback.use();
  const updateAutoLockDelayMs = actions.updateAutoLockDelayMs.use();
  const updateAutoShutDownDelayMs = actions.updateAutoShutDownDelayMs.use();
  const updatePassphraseEnabled = actions.updatePassphraseEnabled.use();
  const updateInputPinOnSoftware = actions.updateInputPinOnSoftware.use();

  return {
    refresh,
    getCurrentWalletId,
    updateDeviceMetaState,
    getWalletWithDevice,
    getDeviceMetaStatic,
    getDeviceMetaState,
    updateLanguage,
    updateBrightness,
    updateAutoLockDelayMs,
    updateAutoShutDownDelayMs,
    updateHapticFeedback,
    updatePassphraseEnabled,
    updateInputPinOnSoftware,
  };
}
