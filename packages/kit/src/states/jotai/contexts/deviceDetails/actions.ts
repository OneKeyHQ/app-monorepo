import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';
import thirdPartyDeviceUtils from '@onekeyhq/shared/src/utils/thirdPartyDeviceUtils';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  contextAtomMethod,
  currentWalletIdAtom,
  deviceMetaStateAtom,
  deviceMetaStaticAtom,
  deviceStateSnapshotAtom,
  emptyMetaState,
  emptyMetaStatic,
  refreshSettledAtom,
  walletWithDeviceStateAtom,
} from './atoms';
import {
  buildDeviceMetaStateFromState,
  getDeviceMetaStaticDataFromState,
  getDeviceStateSnapshotFromEvent,
  mergeDeviceSettingState,
  pickNewerDeviceStateSnapshot,
  resolveDeviceState,
  resolveUsableWalletWithDevice,
  shouldApplyDeviceSettingMutationLocally,
} from './deviceStateManagement';

import type { IDeviceMetaState, IDeviceMetaStatic } from './atoms';
import type { IDeviceStateSnapshot } from './deviceStateManagement';
import type { DeviceStateEvent } from '@onekeyfe/hd-core';

async function buildDeviceMetaStatic(
  walletWithDevice?: IHwQrWalletWithDevice,
  stateSnapshot?: IDeviceStateSnapshot,
): Promise<IDeviceMetaStatic | undefined> {
  if (!walletWithDevice?.device) {
    return undefined;
  }

  const { device } = walletWithDevice;
  const vendorProfile = getVendorProfile(
    device.vendor ?? EHardwareVendor.onekey,
  );
  const isThirdParty = vendorProfile.isThirdParty;
  const state = isThirdParty
    ? undefined
    : resolveDeviceState({
        persistedState: device.deviceStateInfo,
        snapshot: stateSnapshot,
      });
  if (state) {
    const data = getDeviceMetaStaticDataFromState(state);
    const firmwareTypeLabel = deviceUtils.getFirmwareTypeLabelByFirmwareType({
      firmwareType: data.firmwareType,
      displayFormat: 'withSpace',
    });
    let addWallpaperTitleId = ETranslations.global_wallpaper;
    if (
      !isProtocolV2ProductType(data.deviceType) &&
      deviceUtils.isTouchDevice(data.deviceType)
    ) {
      addWallpaperTitleId = ETranslations.global_wallpaper_add;
    }
    return {
      ...data,
      firmwareVersion: data.firmwareVersion ?? '0.0.0',
      firmwareVersionDisplay: data.firmwareVersion
        ? `${firmwareTypeLabel}v${data.firmwareVersion}`
        : '-',
      firmwareTypeLabel,
      addWallpaperTitleId,
    };
  }

  const features = device.featuresInfo;
  if (!features) {
    return undefined;
  }
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
  const firmwareVersion = versions?.firmwareVersion;
  const firmwareVersionDisplay = firmwareVersion
    ? `${firmwareTypeLabel}v${firmwareVersion}`
    : '-';

  const deviceName = isThirdParty
    ? thirdPartyDeviceUtils.getDeviceName({
        device,
        features,
        defaultDeviceName: vendorProfile.defaultDeviceName,
      })
    : await deviceUtils.buildDeviceName({
        device,
        features,
      });

  return {
    deviceName,
    bleName: isThirdParty
      ? undefined
      : deviceUtils.buildDeviceBleName({ features }),
    serialNo: device.uuid,
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
  stateSnapshot?: IDeviceStateSnapshot,
): Promise<IDeviceMetaState | undefined> {
  if (!walletWithDevice?.device) {
    return undefined;
  }

  const { device } = walletWithDevice;
  const vendorProfile = getVendorProfile(
    device.vendor ?? EHardwareVendor.onekey,
  );
  if (!vendorProfile.isThirdParty) {
    const state = resolveDeviceState({
      persistedState: device.deviceStateInfo,
      snapshot: stateSnapshot,
    });
    if (state) {
      return buildDeviceMetaStateFromState({
        isVerified: Boolean(device.verifiedAtVersion),
        pinOnAppEnabled: isProtocolV2ProductType(device.deviceType)
          ? undefined
          : Boolean(device.settings?.inputPinOnSoftware),
        state,
      });
    }
  }
  const features = device.featuresInfo;
  if (!features) {
    return undefined;
  }
  const thirdPartyState = thirdPartyDeviceUtils.getDeviceState({
    features: features as Record<string, unknown>,
  });
  const isVerified = Boolean(device.verifiedAtVersion);
  const autoLockDelayMs = thirdPartyState.autoLockDelayMs ?? 0;
  const autoShutDownDelayMs = thirdPartyState.autoShutDownDelayMs ?? 0;
  const language = features.language ?? undefined;
  const hapticFeedback = thirdPartyState.hapticFeedback ?? false;

  return {
    isVerified,
    unlocked: thirdPartyState.unlocked !== false,
    initialized: thirdPartyState.initialized !== false,
    backupRequired: Boolean(features.backupRequired),
    unlockedByAttachToPin: false,
    passphraseEnabled: Boolean(thirdPartyState.passphraseProtection),
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
        get(deviceStateSnapshotAtom()),
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
        get(deviceStateSnapshotAtom()),
      );
      if (walletId && get(currentWalletIdAtom()) !== walletId) return;
      if (metaState) {
        set(deviceMetaStateAtom(), metaState);
      }
    },
  );

  applyDeviceStateEvent = contextAtomMethod(
    async (get, set, event: DeviceStateEvent) => {
      const data = get(walletWithDeviceStateAtom());
      const vendorProfile = getVendorProfile(
        data?.device?.vendor ?? EHardwareVendor.onekey,
      );
      if (vendorProfile.isThirdParty) {
        return false;
      }
      const currentState = resolveDeviceState({
        persistedState: data?.device?.deviceStateInfo,
        snapshot: get(deviceStateSnapshotAtom()),
      });
      const snapshot = getDeviceStateSnapshotFromEvent({
        device: data?.device,
        currentState,
        event,
      });
      // Evidence for silently dropped events (OK-60121): the page shows
      // stale settings exactly when this reports applied=false.
      defaultLogger.hardware.sdkLog.serviceEvent('applyDeviceStateEvent', {
        applied: Boolean(snapshot),
        source: event.source,
        revision: event.state?.revision,
        eventUpdatedAt: event.state?.updatedAt,
        currentUpdatedAt: currentState?.updatedAt,
        currentRevision: currentState?.revision,
        language: event.state?.settings?.language,
      });
      if (!snapshot) {
        return false;
      }
      set(deviceStateSnapshotAtom(), snapshot);
      const walletId = get(currentWalletIdAtom());
      await this.updateDeviceMetaStatic.call(set, walletId);
      await this.updateDeviceMetaState.call(set, walletId);
      return true;
    },
  );

  refresh = contextAtomMethod(
    async (
      get,
      set,
      incomingWalletId?: string,
      options?: {
        refreshFirmwareInfo?: boolean;
        skipDeviceStateSnapshot?: boolean;
      },
    ) => {
      const walletId = incomingWalletId ?? get(currentWalletIdAtom());
      if (!walletId) return;

      // Device switched: reset header state so the skeleton re-engages.
      if (walletId !== get(currentWalletIdAtom())) {
        set(currentWalletIdAtom(), walletId);
        set(walletWithDeviceStateAtom(), undefined);
        set(deviceStateSnapshotAtom(), undefined);
        set(deviceMetaStaticAtom(), emptyMetaStatic);
        set(deviceMetaStateAtom(), emptyMetaState);
        set(refreshSettledAtom(), false);
      }

      try {
        const r =
          await backgroundApiProxy.serviceAccount.getAllHwQrWalletWithDevice({
            filterHiddenWallet: false,
          });

        const data = resolveUsableWalletWithDevice(
          r?.[walletId],
          Object.values(r),
        );
        // Drop a superseded response (device switched mid-flight).
        if (get(currentWalletIdAtom()) !== walletId) {
          return data;
        }
        set(currentWalletIdAtom(), walletId);
        if (get(walletWithDeviceStateAtom())?.device?.id !== data?.device?.id) {
          set(deviceStateSnapshotAtom(), undefined);
          set(deviceMetaStaticAtom(), emptyMetaStatic);
          set(deviceMetaStateAtom(), emptyMetaState);
          set(refreshSettledAtom(), false);
        }
        set(walletWithDeviceStateAtom(), data);
        if (!data) {
          set(deviceStateSnapshotAtom(), undefined);
          set(deviceMetaStaticAtom(), emptyMetaStatic);
          set(deviceMetaStateAtom(), emptyMetaState);
          return undefined;
        }
        const vendorProfile = getVendorProfile(
          data?.device?.vendor ?? EHardwareVendor.onekey,
        );
        if (
          data?.device?.connectId &&
          !vendorProfile.isThirdParty &&
          !options?.skipDeviceStateSnapshot
        ) {
          const snapshot = await backgroundApiProxy.serviceHardware
            .getDeviceManagementSnapshot({
              connectId: data.device.connectId,
              refreshInfo: options?.refreshFirmwareInfo,
            })
            .catch(() => undefined);
          if (get(currentWalletIdAtom()) !== walletId) {
            return data;
          }
          set(
            deviceStateSnapshotAtom(),
            pickNewerDeviceStateSnapshot({
              current: get(deviceStateSnapshotAtom()),
              // When the live read fails (e.g. the device reboots right
              // after a firmware update), fall back to the persisted state
              // so a retained snapshot cannot outlive newer DB data.
              incoming:
                snapshot ??
                (data?.device?.deviceStateInfo
                  ? { state: data.device.deviceStateInfo }
                  : undefined),
            }),
          );
        } else if (!vendorProfile.isThirdParty) {
          set(
            deviceStateSnapshotAtom(),
            pickNewerDeviceStateSnapshot({
              current: get(deviceStateSnapshotAtom()),
              incoming: data?.device?.deviceStateInfo
                ? { state: data.device.deviceStateInfo }
                : undefined,
            }),
          );
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
    return get(walletWithDeviceStateAtom())?.wallet.id;
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

  updateDeviceSettingState = contextAtomMethod(
    async (get, set, next: Partial<IDeviceMetaState>) => {
      set(
        deviceMetaStateAtom(),
        mergeDeviceSettingState(get(deviceMetaStateAtom()), next),
      );
    },
  );

  syncDeviceSettingStateAfterMutation = contextAtomMethod(
    async (get, set, next: Partial<IDeviceMetaState>) => {
      const walletId = get(currentWalletIdAtom());
      if (!walletId) return;

      const deviceType = get(walletWithDeviceStateAtom())?.device?.deviceType;
      if (!shouldApplyDeviceSettingMutationLocally(deviceType, next)) {
        return;
      }
      await this.updateDeviceSettingState.call(set, next);
    },
  );

  updateLanguage = contextAtomMethod(async (get, set, value: string) => {
    const walletId = get(walletWithDeviceStateAtom())?.wallet.id;
    if (!walletId) return;

    await backgroundApiProxy.serviceHardware.setLanguage({
      walletId,
      language: value,
    });
    await this.syncDeviceSettingStateAfterMutation.call(set, {
      language: value,
    });
  });

  updateBrightness = contextAtomMethod(async (get, set, value?: number) => {
    const walletId = get(walletWithDeviceStateAtom())?.wallet.id;
    if (!walletId) return;

    await backgroundApiProxy.serviceHardware.setBrightness({
      walletId,
      brightness: value,
    });
    await this.syncDeviceSettingStateAfterMutation.call(
      set,
      typeof value === 'number' ? { brightness: value } : {},
    );
  });

  updateHapticFeedback = contextAtomMethod(async (get, set, value: boolean) => {
    const walletId = get(walletWithDeviceStateAtom())?.wallet.id;
    if (!walletId) return;

    await backgroundApiProxy.serviceHardware.setHapticFeedback({
      walletId,
      hapticFeedback: value,
    });
    await this.syncDeviceSettingStateAfterMutation.call(set, {
      hapticFeedback: value,
    });
  });

  updateAutoLockDelayMs = contextAtomMethod(async (get, set, value: number) => {
    const walletId = get(walletWithDeviceStateAtom())?.wallet.id;
    if (!walletId) return;

    await backgroundApiProxy.serviceHardware.setAutoLockDelayMs({
      walletId,
      autoLockDelayMs: value,
    });
    await this.syncDeviceSettingStateAfterMutation.call(set, {
      autoLockDelayMs: value,
    });
  });

  updateAutoShutDownDelayMs = contextAtomMethod(
    async (get, set, value: number) => {
      const walletId = get(walletWithDeviceStateAtom())?.wallet.id;
      if (!walletId) return;

      await backgroundApiProxy.serviceHardware.setAutoShutDownDelayMs({
        walletId,
        autoShutdownDelayMs: value,
      });
      await this.syncDeviceSettingStateAfterMutation.call(set, {
        autoShutDownDelayMs: value,
      });
    },
  );

  updatePassphraseEnabled = contextAtomMethod(
    async (get, set, value: boolean) => {
      const walletId = get(walletWithDeviceStateAtom())?.wallet.id;
      if (!walletId) return;

      await backgroundApiProxy.serviceHardware.setPassphraseEnabled({
        walletId,
        passphraseEnabled: value,
      });
      await this.syncDeviceSettingStateAfterMutation.call(set, {
        passphraseEnabled: value,
      });
    },
  );

  updateInputPinOnSoftware = contextAtomMethod(
    async (get, set, value: boolean) => {
      const walletId = get(walletWithDeviceStateAtom())?.wallet.id;
      if (!walletId) return;

      await backgroundApiProxy.serviceHardware.setInputPinOnSoftware({
        walletId,
        inputPinOnSoftware: value,
      });
      await this.syncDeviceSettingStateAfterMutation.call(set, {
        pinOnAppEnabled: value,
      });
    },
  );
}

const createActions = memoFn(() => new DeviceDetailsActions());

export function useDeviceDetailsActions() {
  const actions = createActions();
  const applyDeviceStateEvent = actions.applyDeviceStateEvent.use();
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
    applyDeviceStateEvent,
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
