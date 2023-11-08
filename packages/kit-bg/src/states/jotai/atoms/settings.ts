import type { LocaleSymbol } from '@onekeyhq/components';
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
  isPasswordSet: boolean;
  isBiologyAuthSwitchOn: boolean;
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
      isBiologyAuthSwitchOn: true,
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
