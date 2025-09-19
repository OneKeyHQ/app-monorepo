/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  EPerpUserType,
  type IHex,
  type IPerpCommonConfig,
  type IPerpUserConfig,
  type IPerpsUniverse,
} from '@onekeyhq/shared/types/hyperliquid';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export interface IPerpsSelectedAccount {
  accountId: string | null;
  indexedAccountId: string | null;
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
  },
});

export interface IPerpsConfigPersistAtom {
  perpConfigCommon: IPerpCommonConfig;
  perpUserConfig: IPerpUserConfig;
}
export const {
  target: perpsConfigPersistAtom,
  use: usePerpsConfigPersistAtom,
} = globalAtom<IPerpsConfigPersistAtom>({
  name: EAtomNames.perpsConfigPersistAtom,
  persist: true,
  initialValue: {
    perpConfigCommon: {},
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
  },
});
