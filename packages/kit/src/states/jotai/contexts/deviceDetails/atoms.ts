import { createJotaiContext } from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';

import type { IPro2DeviceManagementSnapshot } from './pro2DeviceManagement';
import type { EDeviceType } from '@onekeyfe/hd-shared';

const {
  Provider: ProviderJotaiContextDeviceDetails,
  contextAtom,
  contextAtomComputed,
  contextAtomMethod,
} = createJotaiContext();

export {
  ProviderJotaiContextDeviceDetails,
  contextAtom,
  contextAtomComputed,
  contextAtomMethod,
};

// --------- Atoms ----------
export const { atom: currentWalletIdAtom, use: useCurrentWalletIdAtom } =
  contextAtom<string | undefined>(undefined);
export const {
  atom: walletWithDeviceStateAtom,
  use: useWalletWithDeviceStateAtom,
} = contextAtom<IHwQrWalletWithDevice | undefined>(undefined);

export const {
  atom: pro2DeviceManagementSnapshotAtom,
  use: usePro2DeviceManagementSnapshotAtom,
} = contextAtom<IPro2DeviceManagementSnapshot | undefined>(undefined);

// True once the first refresh settles; distinguishes "still loading" from
// "loaded, no device" for the header skeleton gate.
export const { atom: refreshSettledAtom, use: useRefreshSettledAtom } =
  contextAtom<boolean>(false);

export const { atom: walletWithDeviceAtom, use: useWalletWithDeviceAtom } =
  contextAtomComputed((get) => {
    return get(walletWithDeviceStateAtom());
  });

export const { atom: deviceAtom, use: useDeviceAtom } = contextAtomComputed(
  (get) => get(walletWithDeviceAtom())?.device,
);

export type IDeviceMetaStatic = {
  deviceName?: string;
  deviceType?: EDeviceType;
  firmwareType?: Awaited<ReturnType<typeof deviceUtils.getFirmwareType>>;
  firmwareVersion: string;
  firmwareVersionDisplay: string;
  firmwareTypeLabel: string;
  addWallpaperTitleId?: ETranslations;
};

export const emptyMetaStatic: IDeviceMetaStatic = {
  deviceName: undefined,
  deviceType: undefined,
  firmwareType: undefined,
  firmwareVersion: '0.0.0',
  firmwareVersionDisplay: '-',
  firmwareTypeLabel: '',
  addWallpaperTitleId: ETranslations.global_wallpaper,
};

export const { atom: deviceMetaStaticAtom, use: useDeviceMetaStaticAtom } =
  contextAtom<IDeviceMetaStatic>(emptyMetaStatic);

export type IDeviceMetaState = {
  isVerified: boolean;
  unlocked: boolean;
  initialized: boolean;
  backupRequired: boolean;
  unlockedByAttachToPin: boolean;
  passphraseEnabled: boolean;
  pinOnAppEnabled: boolean;
  autoLockDelayMs: number | undefined;
  autoShutDownDelayMs: number | undefined;
  language: string | undefined;
  brightness: number | undefined;
  hapticFeedback: boolean;
  /** false = still the loading placeholder; true = real device data resolved */
  isReady: boolean;
};

export const emptyMetaState: IDeviceMetaState = {
  isVerified: false,
  unlocked: false,
  initialized: false,
  backupRequired: false,
  unlockedByAttachToPin: false,
  passphraseEnabled: false,
  pinOnAppEnabled: false,
  autoLockDelayMs: undefined,
  autoShutDownDelayMs: undefined,
  language: undefined,
  brightness: undefined,
  hapticFeedback: false,
  isReady: false,
};

export const { atom: deviceMetaStateAtom, use: useDeviceMetaStateAtom } =
  contextAtom<IDeviceMetaState>(emptyMetaState);

export const { atom: deviceTypeAtom, use: useDeviceTypeAtom } =
  contextAtomComputed((get) => get(deviceMetaStaticAtom())?.deviceType);

export const { atom: deviceConnectIdAtom, use: useDeviceConnectIdAtom } =
  contextAtomComputed((get) => get(deviceAtom())?.connectId);

export const {
  atom: deviceAutoLockDelayMsAtom,
  use: useDeviceAutoLockDelayMsAtom,
} = contextAtomComputed((get) => get(deviceMetaStateAtom())?.autoLockDelayMs);

export const {
  atom: deviceAutoShutDownDelayMsAtom,
  use: useDeviceAutoShutDownDelayMsAtom,
} = contextAtomComputed(
  (get) => get(deviceMetaStateAtom())?.autoShutDownDelayMs,
);

export const { atom: deviceLanguageAtom, use: useDeviceLanguageAtom } =
  contextAtomComputed((get) => get(deviceMetaStateAtom())?.language);

export const { atom: deviceBrightnessAtom, use: useDeviceBrightnessAtom } =
  contextAtomComputed((get) => get(deviceMetaStateAtom())?.brightness);

export const {
  atom: deviceHapticFeedbackAtom,
  use: useDeviceHapticFeedbackAtom,
} = contextAtomComputed((get) => get(deviceMetaStateAtom())?.hapticFeedback);

export const {
  atom: deviceSettingsAccessibleAtom,
  use: useDeviceSettingsAccessibleAtom,
} = contextAtomComputed((get) => get(deviceMetaStateAtom())?.unlocked);

export const {
  atom: devicePassphraseEnabledAtom,
  use: useDevicePassphraseEnabledAtom,
} = contextAtomComputed((get) => get(deviceMetaStateAtom())?.passphraseEnabled);

export const {
  atom: devicePinOnAppEnabledAtom,
  use: useDevicePinOnAppEnabledAtom,
} = contextAtomComputed((get) => get(deviceMetaStateAtom())?.pinOnAppEnabled);
