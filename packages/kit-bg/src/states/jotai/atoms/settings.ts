import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { EOnekeyDomain } from '@onekeyhq/shared/types';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IEndpointType = 'prod' | 'test';

export type ISettingsPersistAtom = {
  theme: 'light' | 'dark' | 'system';
  lastLocale: ILocaleSymbol;
  locale: ILocaleSymbol;
  version: string;
  buildNumber?: string;
  reviewControl?: boolean;
  instanceId: string;
  sensitiveEncodeKey: string;
  isBiologyAuthSwitchOn: boolean;
  protectCreateTransaction: boolean;
  protectCreateOrRemoveWallet: boolean;
  tokenRiskReminder: boolean;
  spendDustUTXO: boolean;

  hardwareConnectSrc: EOnekeyDomain;
  currencyInfo: {
    symbol: string;
    id: string;
  };
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
      sensitiveEncodeKey: generateUUID(),
      isBiologyAuthSwitchOn: true,
      protectCreateTransaction: false,
      protectCreateOrRemoveWallet: false,
      tokenRiskReminder: true,
      spendDustUTXO: false,
      hardwareConnectSrc: EOnekeyDomain.ONEKEY_SO,
      currencyInfo: {
        id: 'usd',
        symbol: '$',
      },
    },
  });

type ISettingsLastActivityPersistAtom = {
  time: number;
};

export const {
  target: settingsLastActivityAtom,
  use: useSettingsLastActivityAtom,
} = globalAtom<ISettingsLastActivityPersistAtom>({
  name: EAtomNames.settingsLastActivityAtom,
  initialValue: {
    time: Date.now(),
  },
});

type ISettingsAtom = {
  swapToAnotherAccountSwitchOn: boolean;
};

export const { target: settingsAtom, use: useSettingsAtom } =
  globalAtom<ISettingsAtom>({
    name: EAtomNames.settingsAtom,
    initialValue: {
      swapToAnotherAccountSwitchOn: false,
    },
  });

// extract high frequency refresh data to another atom
