import type { ILocaleSymbol } from '@onekeyhq/components';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { EOnekeyDomain } from '@onekeyhq/shared/types';

import { EAtomNames } from '../atomNames';
import { globalAtom, globalAtomComputed } from '../utils';

export type ISettingsPersistAtom = {
  theme: 'light' | 'dark' | 'system';
  lastLocale: ILocaleSymbol;
  locale: ILocaleSymbol;
  version: string;
  buildNumber?: string;
  instanceId: string;
  isBiologyAuthSwitchOn: boolean;
  protectCreateTransaction: boolean;
  protectCreateOrRemoveWallet: boolean;
  spendDustUTXO: boolean;
  appLockDuration: number;
  hardwareConnectSrc: EOnekeyDomain;
  endpointType: 'prod' | 'test';
  currency: string;
};
export const { target: settingsPersistAtom, use: useSettingsPersistAtom } =
  globalAtom<ISettingsPersistAtom>({
    persist: true,
    name: EAtomNames.settingsPersistAtom,

    initialValue: {
      theme: 'system',
      lastLocale: 'system',
      locale: 'system',
      version: process.env.VERSION ?? '1.0.0',
      buildNumber: process.env.BUILD_NUMBER ?? '2022010100',
      instanceId: generateUUID(),
      isBiologyAuthSwitchOn: false,
      protectCreateTransaction: false,
      protectCreateOrRemoveWallet: false,
      spendDustUTXO: false,
      appLockDuration: 240,
      hardwareConnectSrc: EOnekeyDomain.ONEKEY_SO,
      endpointType: 'test',
      currency: 'usd',
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
    const settings = get(settingsPersistAtom.atom());
    const timeNow = get(settingsTimeNowAtom.atom());
    return (
      settings.locale === 'zh-CN' &&
      settings.theme === 'light' &&
      timeNow.length > 0
    );
  });
