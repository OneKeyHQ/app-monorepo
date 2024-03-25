import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { EOnekeyDomain } from '@onekeyhq/shared/types';

import { EAtomNames } from '../atomNames';
import { globalAtom, globalAtomComputed } from '../utils';

export type IEndpointType = 'prod' | 'test';

export type ISettingsPersistAtom = {
  theme: 'light' | 'dark' | 'system';
  lastLocale: ILocaleSymbol;
  locale: ILocaleSymbol;
  version: string;
  buildNumber?: string;
  instanceId: string;
  sensitiveEncodeKey: string;
  isBiologyAuthSwitchOn: boolean;
  protectCreateTransaction: boolean;
  protectCreateOrRemoveWallet: boolean;
  spendDustUTXO: boolean;

  hardwareConnectSrc: EOnekeyDomain;
  currencyInfo: {
    symbol: string;
    id: string;
  };
  swapToAnotherAccountSwitchOn: boolean;
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
      swapToAnotherAccountSwitchOn: false,
      isBiologyAuthSwitchOn: true,
      protectCreateTransaction: false,
      protectCreateOrRemoveWallet: false,
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

// extract high frequency refresh data to another atom

export const {
  target: swapToAnotherAccountSwitchOnAtom,
  use: useSwapToAnotherAccountSwitchOnAtom,
} = globalAtomComputed<boolean>((get) => {
  const settings = get(settingsPersistAtom.atom());
  return Boolean(settings.swapToAnotherAccountSwitchOn);
});
