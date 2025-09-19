/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  EPerpUserType,
  type IHex,
  type IMarginTable,
  type IPerpCommonConfig,
  type IPerpUserConfig,
  type IPerpsUniverse,
} from '@onekeyhq/shared/types/hyperliquid';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

import type { IAccountDeriveTypes } from '../../../vaults/types';

export interface IPerpsSelectedAccount {
  accountId: string | null;
  indexedAccountId: string | null;
  deriveType: IAccountDeriveTypes;
  accountAddress: IHex | null;
}
export const {
  target: perpsSelectedAccountAtom,
  use: usePerpsSelectedAccountAtom,
} = globalAtom<IPerpsSelectedAccount>({
  name: EAtomNames.perpsSelectedAccountAtom,
  initialValue: {
    indexedAccountId: null,
    accountId: null,
    accountAddress: null,
    deriveType: 'default',
  },
});

export interface IPerpsCommonConfigPersistAtom {
  perpConfigCommon: IPerpCommonConfig;
}
export const {
  target: perpsCommonConfigPersistAtom,
  use: usePerpsCommonConfigPersistAtom,
} = globalAtom<IPerpsCommonConfigPersistAtom>({
  name: EAtomNames.perpsCommonConfigPersistAtom,
  persist: true,
  initialValue: {
    perpConfigCommon: {},
  },
});
export interface IPerpsUserConfigPersistAtom {
  perpUserConfig: IPerpUserConfig;
}
export const {
  target: perpsUserConfigPersistAtom,
  use: usePerpsUserConfigPersistAtom,
} = globalAtom<IPerpsUserConfigPersistAtom>({
  name: EAtomNames.perpsUserConfigPersistAtom,
  persist: true,
  initialValue: {
    perpUserConfig: {
      currentUserType: EPerpUserType.PERP_NATIVE,
    },
  },
});

export interface IPerpsAccountLoadingInfo {
  selectAccountLoading: boolean;
  enableTradingLoading: boolean;
}
export const {
  target: perpsAccountLoadingInfoAtom,
  use: usePerpsAccountLoadingInfoAtom,
} = globalAtom<IPerpsAccountLoadingInfo>({
  name: EAtomNames.perpsAccountLoadingInfoAtom,
  initialValue: {
    selectAccountLoading: false,
    enableTradingLoading: false,
  },
});

export type IPerpsSelectedAccountStatusDetails = {
  activatedOk: boolean;
  agentOk: boolean;
  referralCodeOk: boolean;
  builderFeeOk: boolean;
};
export interface IPerpsSelectedAccountStatus {
  accountAddress: IHex | null;
  canTrade: boolean;
  details: IPerpsSelectedAccountStatusDetails;
}
export const {
  target: perpsSelectedAccountStatusAtom,
  use: usePerpsSelectedAccountStatusAtom,
} = globalAtom<IPerpsSelectedAccountStatus>({
  name: EAtomNames.perpsSelectedAccountStatusAtom,
  initialValue: {
    accountAddress: null,
    canTrade: false,
    details: {
      agentOk: false,
      builderFeeOk: false,
      referralCodeOk: false,
      activatedOk: false,
    },
  },
});

export interface IPerpsSelectedSymbol {
  coin: string;
  universe: IPerpsUniverse | undefined;
  margin: IMarginTable | undefined;
}
export const {
  target: perpsSelectedSymbolAtom,
  use: usePerpsSelectedSymbolAtom,
} = globalAtom<IPerpsSelectedSymbol>({
  name: EAtomNames.perpsSelectedSymbolAtom,
  persist: true,
  initialValue: {
    coin: 'ETH',
    universe: undefined,
    margin: undefined,
  },
});

export interface IPerpsCustomSettings {
  skipOrderConfirm: boolean;
}
export const {
  target: perpsCustomSettingsAtom,
  use: usePerpsCustomSettingsAtom,
} = globalAtom<IPerpsCustomSettings>({
  name: EAtomNames.perpsCustomSettingsAtom,
  persist: true,
  initialValue: {
    skipOrderConfirm: false,
  },
});
