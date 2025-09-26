/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
  IHex,
  IMarginTable,
  IPerpCommonConfig,
  IPerpUserConfig,
  IPerpsActiveAssetData,
  IPerpsFormattedAssetCtx,
  IPerpsUniverse,
  IWsActiveAssetCtx,
} from '@onekeyhq/shared/types/hyperliquid';
import { EPerpUserType } from '@onekeyhq/shared/types/hyperliquid';

import { EAtomNames } from '../atomNames';
import { globalAtom, globalAtomComputedR } from '../utils';

import type { IAccountDeriveTypes } from '../../../vaults/types';

// #region Active Account
export interface IPerpsActiveAccountAtom {
  accountId: string | null;
  indexedAccountId: string | null;
  deriveType: IAccountDeriveTypes;
  accountAddress: IHex | null;
}
export const {
  target: perpsActiveAccountAtom,
  use: usePerpsActiveAccountAtom,
} = globalAtom<IPerpsActiveAccountAtom>({
  name: EAtomNames.perpsActiveAccountAtom,
  initialValue: {
    indexedAccountId: null,
    accountId: null,
    accountAddress: null,
    deriveType: 'default',
  },
});

export type IPerpsActiveAccountSummaryAtom =
  | {
      accountAddress: IHex | undefined;
      accountValue: string | undefined;
      totalMarginUsed: string | undefined;
      crossAccountValue: string | undefined;
      crossMaintenanceMarginUsed: string | undefined;
      totalNtlPos: string | undefined;
      totalRawUsd: string | undefined;
      withdrawable: string | undefined;
    }
  | undefined;
export const {
  target: perpsActiveAccountSummaryAtom,
  use: usePerpsActiveAccountSummaryAtom,
} = globalAtom<IPerpsActiveAccountSummaryAtom>({
  name: EAtomNames.perpsActiveAccountSummaryAtom,
  initialValue: undefined,
});

export type IPerpsActiveAccountStatusDetails = {
  activatedOk: boolean;
  agentOk: boolean;
  referralCodeOk: boolean;
  builderFeeOk: boolean;
};
export interface IPerpsActiveAccountStatusInfoAtom {
  accountAddress: IHex | null;
  details: IPerpsActiveAccountStatusDetails;
}
export const { target: perpsActiveAccountStatusInfoAtom } =
  globalAtom<IPerpsActiveAccountStatusInfoAtom>({
    name: EAtomNames.perpsActiveAccountStatusInfoAtom,
    initialValue: {
      accountAddress: null,
      details: {
        agentOk: false,
        builderFeeOk: false,
        referralCodeOk: false,
        activatedOk: false,
      },
    },
  });

export const {
  target: perpsActiveAccountStatusAtom,
  use: usePerpsActiveAccountStatusAtom,
} = globalAtomComputedR<{
  canTrade: boolean | null | undefined;
  canCreateAddress: boolean;
  accountNotSupport: boolean;
  accountAddress: IHex | null;
  details: IPerpsActiveAccountStatusDetails | undefined;
}>({
  read: (get) => {
    const status = get(perpsActiveAccountStatusInfoAtom.atom());
    const account = get(perpsActiveAccountAtom.atom());
    const details: IPerpsActiveAccountStatusDetails | undefined =
      status.accountAddress?.toLowerCase() ===
        account.accountAddress?.toLowerCase() && status.accountAddress
        ? status.details
        : undefined;
    const canTrade =
      account?.accountAddress &&
      details?.agentOk &&
      details?.builderFeeOk &&
      details?.referralCodeOk &&
      details?.activatedOk;
    const accountNotSupport =
      !account?.accountAddress && !account?.indexedAccountId;
    const canCreateAddress =
      !account?.accountAddress && !!account?.indexedAccountId;
    return {
      canTrade,
      canCreateAddress,
      accountAddress: account?.accountAddress?.toLowerCase() as IHex | null,
      accountNotSupport,
      details,
    };
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

// #endregion

// #region Active Asset
export interface IPerpsActiveAssetAtom {
  coin: string;
  assetId: number | undefined;
  universe: IPerpsUniverse | undefined;
  margin: IMarginTable | undefined;
}
export const { target: perpsActiveAssetAtom, use: usePerpsActiveAssetAtom } =
  globalAtom<IPerpsActiveAssetAtom>({
    name: EAtomNames.perpsActiveAssetAtom,
    persist: true,
    initialValue: {
      coin: 'ETH',
      assetId: undefined,
      universe: undefined,
      margin: undefined,
    },
  });

export type IPerpsActiveAssetCtxAtom =
  | {
      coin: string;
      assetId: number | undefined;
      ctx: IPerpsFormattedAssetCtx;
    }
  | undefined;
export const {
  target: perpsActiveAssetCtxAtom,
  use: usePerpsActiveAssetCtxAtom,
} = globalAtom<IPerpsActiveAssetCtxAtom>({
  name: EAtomNames.perpsActiveAssetCtxAtom,
  initialValue: undefined,
});

export type IPerpsActiveAssetDataAtom = IPerpsActiveAssetData | undefined;
export const {
  target: perpsActiveAssetDataAtom,
  use: usePerpsActiveAssetDataAtom,
} = globalAtom<IPerpsActiveAssetDataAtom>({
  name: EAtomNames.perpsActiveAssetDataAtom,
  initialValue: undefined,
});

// #endregion

// #region Settings & Config
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

// #endregion

// TODO remove
export type IPerpsCurrentMid = {
  coin: string;
  mid: string | undefined;
};
export const { target: perpsCurrentMidAtom, use: usePerpsCurrentMidAtom } =
  globalAtom<IPerpsCurrentMid | undefined>({
    name: EAtomNames.perpsCurrentMidAtom,
    initialValue: undefined,
  });

export interface IPerpsNetworkStatus {
  connected: boolean;
  lastMessageAt: number | null;
}

export const {
  target: perpsNetworkStatusAtom,
  use: usePerpsNetworkStatusAtom,
} = globalAtom<IPerpsNetworkStatus>({
  name: EAtomNames.perpsNetworkStatusAtom,
  initialValue: {
    connected: true,
    lastMessageAt: null,
  },
});
