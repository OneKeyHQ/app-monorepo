import type { LocaleSymbol } from '@onekeyhq/components';
import {
  getBiologyAuthType,
  isSupportBiologyAuth,
} from '@onekeyhq/shared/src/biologyAuth';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { EAtomNames } from '../atomNames';
import { globalAtom, globalAtomComputed, globalAtomComputedRW } from '../utils';

import type { AuthenticationType } from 'expo-local-authentication';

export type ISettingsAtom = {
  theme: 'light' | 'dark' | 'system';
  lastLocale: LocaleSymbol;
  locale: LocaleSymbol;
  version: string;
  buildNumber?: string;
  instanceId: string;
  isBiologyAuthEnable: boolean;
  isBiologyAuthSupported?: boolean;
  isPasswordSet: boolean;
  biologyAuthType?: AuthenticationType;
};
export const { target: settingsAtom, use: useSettingsAtom } =
  globalAtom<ISettingsAtom>({
    persist: true,
    name: EAtomNames.settingsAtom,
    initialValue: {
      theme: 'system',
      lastLocale: 'system',
      locale: 'system',
      version: process.env.VERSION ?? '1.0.0',
      buildNumber: process.env.BUILD_NUMBER ?? '2022010100',
      instanceId: generateUUID(),
      isBiologyAuthEnable: false,
      isPasswordSet: false,
    },
  });

// extract high frequency refresh data to another atom
export type ISettingsTimeNowAtom = string;
export const { target: settingsTimeNowAtom, use: useSettingsTimeNowAtom } =
  globalAtom<ISettingsTimeNowAtom>({
    name: EAtomNames.settingsTimeNowAtom,
    initialValue: new Date().toISOString(),
  });

export const { target: settingsIsLightCNAtom, use: useSettingsIsLightCNAtom } =
  globalAtomComputed((get) => {
    const settings = get(settingsAtom.atom());
    const timeNow = get(settingsTimeNowAtom.atom());
    return (
      settings.locale === 'zh-CN' &&
      settings.theme === 'light' &&
      timeNow.length > 0
    );
  });

export const {
  target: settingsIsBioAuthSupportedAtom,
  use: useSettingsIsBioAuthSupportedAtom,
} = globalAtomComputed(async () => isSupportBiologyAuth());

export const {
  target: settingsBiologyAuthTypeAtom,
  use: useSettingsBiologyAuthTypeAtom,
} = globalAtomComputed(async () => getBiologyAuthType());

export const {
  target: settingsIsBioAuthEnableAtom,
  use: useSettingsIsBioAuthEnableAtom,
} = globalAtomComputedRW<Promise<boolean>, [boolean], void>({
  read: async (get) => {
    const isSupport = await get(settingsIsBioAuthSupportedAtom.atom());
    return isSupport && get(settingsAtom.atom()).isBiologyAuthEnable;
  },
  write: (get, set, value) => {
    const settings = get(settingsAtom.atom());
    set(settingsAtom.atom(), {
      ...settings,
      isBiologyAuthEnable: value,
    });
  },
});
