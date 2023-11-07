import type { LocaleSymbol } from '@onekeyhq/components';
import biologyAuth from '@onekeyhq/shared/src/biologyAuth';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { EAtomNames } from '../atomNames';
import { globalAtom, globalAtomComputed } from '../utils';

export type ISettingsAtom = {
  theme: 'light' | 'dark' | 'system';
  lastLocale: LocaleSymbol;
  locale: LocaleSymbol;
  version: string;
  buildNumber?: string;
  instanceId: string;
  isBiologyAuthSupported?: boolean;
  isPasswordSet: boolean;
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
  target: settingsIsBiologyAuthSwitchOnAtom,
  use: useSettingsIsBiologyAuthSwitchOnAtom,
} = globalAtom({
  persist: true,
  name: EAtomNames.settingsIsBiologyAuthSwitchOnAtom,
  initialValue: true,
});

export const {
  target: settingsBiologyAuthInfoAtom,
  use: useSettingsBiologyAuthInfoAtom,
} = globalAtomComputed(async (get) => {
  const authType = await biologyAuth.getBiologyAuthType();
  const isSupport = await biologyAuth.isSupportBiologyAuth();
  const isEnable = isSupport && get(settingsIsBiologyAuthSwitchOnAtom.atom());
  return { authType, isSupport, isEnable };
});
