import { createJotaiContext } from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';

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

const emptyMetaStatic: IDeviceMetaStatic = {
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
  passphraseEnabled: boolean;
  pinOnAppEnabled: boolean;
  autoLockDelayMs: number | undefined;
  autoShutDownDelayMs: number | undefined;
  language: string | undefined;
  hapticFeedback: boolean;
};

const emptyMetaState: IDeviceMetaState = {
  isVerified: false,
  passphraseEnabled: false,
  pinOnAppEnabled: false,
  autoLockDelayMs: undefined,
  autoShutDownDelayMs: undefined,
  language: undefined,
  hapticFeedback: false,
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

export const {
  atom: deviceHapticFeedbackAtom,
  use: useDeviceHapticFeedbackAtom,
} = contextAtomComputed((get) => get(deviceMetaStateAtom())?.hapticFeedback);

export const {
  atom: devicePassphraseEnabledAtom,
  use: useDevicePassphraseEnabledAtom,
} = contextAtomComputed((get) => get(deviceMetaStateAtom())?.passphraseEnabled);

export const {
  atom: devicePinOnAppEnabledAtom,
  use: useDevicePinOnAppEnabledAtom,
} = contextAtomComputed((get) => get(deviceMetaStateAtom())?.pinOnAppEnabled);
