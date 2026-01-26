import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';

import {
  contextAtomMethod,
  currentWalletIdAtom,
  deviceMetaStateAtom,
  deviceMetaStaticAtom,
  walletWithDeviceStateAtom,
} from './atoms';

import type { IDeviceMetaState, IDeviceMetaStatic } from './atoms';

async function buildDeviceMetaStatic(
  walletWithDevice?: IHwQrWalletWithDevice,
): Promise<IDeviceMetaStatic | undefined> {
  if (!walletWithDevice?.device?.featuresInfo) {
    return undefined;
  }

  const { device } = walletWithDevice;
  const features = device.featuresInfo;
  if (!features) {
    return undefined;
  }

  const versions = await deviceUtils.getDeviceVersion({
    device,
    features,
  });
  const deviceType = await deviceUtils.getDeviceTypeFromFeatures({
    features,
  });
  const firmwareType = await deviceUtils.getFirmwareType({
    features,
  });
  const firmwareTypeLabel = deviceUtils.getFirmwareTypeLabelByFirmwareType({
    firmwareType,
    displayFormat: 'withSpace',
  });
  const firmwareVersionDisplay = versions?.firmwareVersion
    ? `${firmwareTypeLabel}v${versions?.firmwareVersion}`
    : '-';

  const deviceName = deviceUtils.buildDeviceBleName({
    features,
  });

  return {
    deviceName,
    deviceType,
    firmwareType,
    firmwareVersion: versions?.firmwareVersion ?? '0.0.0',
    firmwareVersionDisplay,
    firmwareTypeLabel,
    addWallpaperTitleId: deviceUtils.isTouchDevice(deviceType)
      ? ETranslations.global_wallpaper_add
      : ETranslations.global_wallpaper,
  };
}

async function buildDeviceMetaState(
  walletWithDevice?: IHwQrWalletWithDevice,
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
  const autoLockDelayMs = features.auto_lock_delay_ms ?? 0;
  const autoShutDownDelayMs = features.auto_shutdown_delay_ms ?? 0;
  const language = features.language ?? undefined;
  const hapticFeedback = features.haptic_feedback ?? false;

  return {
    isVerified,
    passphraseEnabled: Boolean(features?.passphrase_protection),
    pinOnAppEnabled: Boolean(device.settings?.inputPinOnSoftware),
    autoLockDelayMs,
    autoShutDownDelayMs,
    language,
    hapticFeedback,
  };
}

class DeviceDetailsActions extends ContextJotaiActionsBase {
  updateDeviceMetaStatic = contextAtomMethod(async (get, set) => {
    const data = get(walletWithDeviceStateAtom());
    const metaStatic = await buildDeviceMetaStatic(data);
    if (metaStatic) {
      set(deviceMetaStaticAtom(), metaStatic);
    }
  });

  updateDeviceMetaState = contextAtomMethod(async (get, set) => {
    const data = get(walletWithDeviceStateAtom());
    const metaState = await buildDeviceMetaState(data);
    if (metaState) {
      set(deviceMetaStateAtom(), metaState);
    }
  });

  refresh = contextAtomMethod(async (get, set, incomingWalletId?: string) => {
    const walletId = incomingWalletId ?? get(currentWalletIdAtom());
    if (!walletId) return;

    const r =
      await backgroundApiProxy.serviceAccount.getAllHwQrWalletWithDevice({
        filterHiddenWallet: true,
      });

    const data = r?.[walletId];
    set(currentWalletIdAtom(), walletId);
    set(walletWithDeviceStateAtom(), data);
    await this.updateDeviceMetaStatic.call(set);
    await this.updateDeviceMetaState.call(set);
    return data;
  });

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

  updateLanguage = contextAtomMethod(async (get, set, value: string) => {
    const walletId = get(currentWalletIdAtom());
    if (!walletId) return;

    await backgroundApiProxy.serviceHardware.setLanguage({
      walletId,
      language: value,
    });
  });

  updateBrightness = contextAtomMethod(async (get, _set) => {
    const walletId = get(currentWalletIdAtom());
    if (!walletId) return;

    await backgroundApiProxy.serviceHardware.setBrightness({
      walletId,
    });
  });

  updateHapticFeedback = contextAtomMethod(async (get, set, value: boolean) => {
    const walletId = get(currentWalletIdAtom());
    if (!walletId) return;

    await backgroundApiProxy.serviceHardware.setHapticFeedback({
      walletId,
      hapticFeedback: value,
    });
  });

  updateAutoLockDelayMs = contextAtomMethod(async (get, set, value: number) => {
    const walletId = get(currentWalletIdAtom());
    if (!walletId) return;

    await backgroundApiProxy.serviceHardware.setAutoLockDelayMs({
      walletId,
      autoLockDelayMs: value,
    });
    await this.refresh.call(set);
  });

  updateAutoShutDownDelayMs = contextAtomMethod(
    async (get, set, value: number) => {
      const walletId = get(currentWalletIdAtom());
      if (!walletId) return;

      await backgroundApiProxy.serviceHardware.setAutoShutDownDelayMs({
        walletId,
        autoShutdownDelayMs: value,
      });
      await this.refresh.call(set);
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
