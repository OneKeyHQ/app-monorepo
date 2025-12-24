/* eslint-disable @typescript-eslint/no-unused-vars */
import BigNumber from 'bignumber.js';

import type {
  IFill,
  IHex,
  IL2BookOptions,
  IMarginTable,
  IPerpCommonConfig,
  IPerpTokenSelectorConfig,
  IPerpUserConfig,
  IPerpsActiveAssetData,
  IPerpsFormattedAssetCtx,
  IPerpsUniverse,
} from '@onekeyhq/shared/types/hyperliquid';
import { EPerpUserType } from '@onekeyhq/shared/types/hyperliquid';
import type { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

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

// perpsActiveAccountRefreshHookAtom
export const {
  target: perpsActiveAccountRefreshHookAtom,
  use: usePerpsActiveAccountRefreshHookAtom,
} = globalAtom<{ refreshHook: number }>({
  name: EAtomNames.perpsActiveAccountRefreshHookAtom,
  initialValue: { refreshHook: 0 },
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
      totalUnrealizedPnl: string | undefined;
    }
  | undefined;
export const {
  target: perpsActiveAccountSummaryAtom,
  use: usePerpsActiveAccountSummaryAtom,
} = globalAtom<IPerpsActiveAccountSummaryAtom>({
  name: EAtomNames.perpsActiveAccountSummaryAtom,
  initialValue: undefined,
});

export const {
  target: perpsActiveAccountMmrAtom,
  use: usePerpsActiveAccountMmrAtom,
} = globalAtomComputedR<{ mmr: string | null; mmrPercent: string | null }>({
  read: (get) => {
    const accountSummary = get(perpsActiveAccountSummaryAtom.atom());

    if (
      !accountSummary?.crossMaintenanceMarginUsed ||
      !accountSummary?.crossAccountValue
    ) {
      return { mmr: null, mmrPercent: null };
    }

    const maintenanceMarginUsed = new BigNumber(
      accountSummary.crossMaintenanceMarginUsed,
    );
    const accountValue = new BigNumber(accountSummary.crossAccountValue);

    // Avoid division by zero
    if (accountValue.isZero()) {
      return { mmr: null, mmrPercent: null };
    }

    const mmr = maintenanceMarginUsed.dividedBy(accountValue);
    return { mmr: mmr.toFixed(), mmrPercent: mmr.multipliedBy(100).toFixed(2) };
  },
});

export type IPerpsActiveAccountStatusDetails = {
  activatedOk: boolean;
  agentOk: boolean;
  referralCodeOk: boolean;
  builderFeeOk: boolean;
  internalRebateBoundOk: boolean;
};
export type IPerpsActiveAccountStatusInfoAtom =
  | {
      accountAddress: IHex | null;
      details: IPerpsActiveAccountStatusDetails;
    }
  | undefined;
export const { target: perpsActiveAccountStatusInfoAtom } =
  globalAtom<IPerpsActiveAccountStatusInfoAtom>({
    name: EAtomNames.perpsActiveAccountStatusInfoAtom,
    initialValue: undefined,
  });

export type IPerpsActiveAccountStatusAtom = {
  canTrade: boolean | null | undefined;
  canCreateAddress: boolean;
  accountNotSupport: boolean;
  accountAddress: IHex | null;
  details: IPerpsActiveAccountStatusDetails | undefined;
};
export const {
  target: perpsActiveAccountStatusAtom,
  use: usePerpsActiveAccountStatusAtom,
} = globalAtomComputedR<IPerpsActiveAccountStatusAtom>({
  read: (get) => {
    const status = get(perpsActiveAccountStatusInfoAtom.atom());
    const account = get(perpsActiveAccountAtom.atom());
    const details: IPerpsActiveAccountStatusDetails | undefined =
      status?.accountAddress &&
      status?.accountAddress?.toLowerCase() ===
        account.accountAddress?.toLowerCase()
        ? status.details
        : undefined;
    const canTrade =
      account?.accountAddress &&
      details?.agentOk &&
      details?.builderFeeOk &&
      details?.referralCodeOk &&
      details?.activatedOk &&
      details?.internalRebateBoundOk;
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

export const {
  target: perpsActiveAccountIsAgentReadyAtom,
  use: usePerpsActiveAccountIsAgentReadyAtom,
} = globalAtomComputedR<{ isAgentReady: boolean }>({
  read: (get) => {
    const status = get(perpsActiveAccountStatusAtom.atom());
    return {
      isAgentReady: Boolean(status?.details?.agentOk && status?.canTrade),
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

export const {
  target: perpsShouldShowEnableTradingButtonAtom,
  use: usePerpsShouldShowEnableTradingButtonAtom,
} = globalAtomComputedR<boolean>({
  read: (get) => {
    const status = get(perpsActiveAccountStatusAtom.atom());
    const loading = get(perpsAccountLoadingInfoAtom.atom());
    const isAccountLoading =
      loading.enableTradingLoading || loading.selectAccountLoading;
    return isAccountLoading || !status?.canTrade || !status?.accountAddress;
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

// Token Selector Config (Persisted)
export const {
  target: perpTokenSelectorConfigPersistAtom,
  use: usePerpTokenSelectorConfigPersistAtom,
} = globalAtom<IPerpTokenSelectorConfig | null>({
  name: EAtomNames.perpTokenSelectorConfigPersistAtom,
  persist: true,
  initialValue: {
    field: 'volume24h',
    direction: 'desc',
    activeTab: 'all',
  },
});

export type IPerpsActiveOrderBookOptionsAtom =
  | (IL2BookOptions & {
      coin: string;
      assetId: number | undefined;
    })
  | undefined;
export const {
  target: perpsActiveOrderBookOptionsAtom,
  use: usePerpsActiveOrderBookOptionsAtom,
} = globalAtom<IPerpsActiveOrderBookOptionsAtom>({
  name: EAtomNames.perpsActiveOrderBookOptionsAtom,
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
    perpConfigCommon: {
      disablePerp: true, // Default to hide perps tab, will be overridden by server config
    },
  },
});

export interface IPerpsDepositNetwork {
  networkId: string;
  name: string;
  code: string;
  shortcode: string;
  shortname: string;
  logoURI: string;
  symbol: string;
  decimals: number;
}

export interface IPerpsDepositNetworksAtom {
  networks: IPerpsDepositNetwork[];
  currentPerpsDepositSelectedNetwork?: IPerpsDepositNetwork;
}
export const {
  target: perpsDepositNetworksAtom,
  use: usePerpsDepositNetworksAtom,
} = globalAtom<IPerpsDepositNetworksAtom>({
  name: EAtomNames.perpsDepositNetworksAtom,
  initialValue: {
    networks: [],
  },
});
export interface IPerpsDepositToken {
  networkId: string;
  contractAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  networkLogoURI: string;
  price?: string;
  balanceParsed?: string;
  fiatValue?: string;
  isNative?: boolean;
  logoURI?: string;
}

export interface IPerpsDepositTokensAtom {
  tokens: Record<string, IPerpsDepositToken[]>;
  currentPerpsDepositSelectedToken?: IPerpsDepositToken;
}
export const {
  target: perpsDepositTokensAtom,
  use: usePerpsDepositTokensAtom,
} = globalAtom<IPerpsDepositTokensAtom>({
  name: EAtomNames.perpsDepositTokensAtom,
  initialValue: {
    tokens: {},
  },
});

export interface IPerpsDepositOrderAtom {
  isArbUSDCOrder: boolean;
  fromTxId: string;
  toTxId?: string;
  amount: string;
  token: IPerpsDepositToken;
  status: ESwapTxHistoryStatus;
  accountId?: string | null;
  indexedAccountId?: string | null;
  time?: number;
}

export const { target: perpsDepositOrderAtom, use: usePerpsDepositOrderAtom } =
  globalAtom<{ orders: IPerpsDepositOrderAtom[] }>({
    name: EAtomNames.perpsDepositOrderAtom,
    persist: true,
    initialValue: {
      orders: [],
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

export interface IPerpsTradingPreferences {
  sizeInputUnit: 'token' | 'usd' | 'margin';
  slippage: number;
}
export const {
  target: perpsTradingPreferencesAtom,
  use: usePerpsTradingPreferencesAtom,
} = globalAtom<IPerpsTradingPreferences>({
  name: EAtomNames.perpsTradingPreferencesAtom,
  persist: true,
  initialValue: {
    sizeInputUnit: 'usd',
    slippage: 8,
  },
});

export type IPerpsLastUsedLeverageAtom = Record<string, number>;

export const {
  target: perpsLastUsedLeverageAtom,
  use: usePerpsLastUsedLeverageAtom,
} = globalAtom<IPerpsLastUsedLeverageAtom>({
  name: EAtomNames.perpsLastUsedLeverageAtom,
  persist: true,
  initialValue: {},
});

// #endregion

export interface IPerpsNetworkStatus {
  connected: boolean | undefined;
  lastMessageAt: number | null;
}

export const {
  target: perpsNetworkStatusAtom,
  use: usePerpsNetworkStatusAtom,
} = globalAtom<IPerpsNetworkStatus>({
  name: EAtomNames.perpsNetworkStatusAtom,
  initialValue: {
    connected: undefined,
    lastMessageAt: null,
  },
});

export const {
  target: perpsWebSocketReadyStateAtom,
  use: usePerpsWebSocketReadyStateAtom,
} = globalAtom<{ readyState: number | undefined } | undefined>({
  name: EAtomNames.perpsWebSocketReadyStateAtom,
  initialValue: undefined,
});

export const {
  target: perpsWebSocketConnectedAtom,
  use: usePerpsWebSocketConnectedAtom,
} = globalAtomComputedR<boolean>({
  read: (get) => {
    const readyState = get(perpsWebSocketReadyStateAtom.atom());
    return readyState?.readyState === WebSocket.OPEN;
  },
});

export const {
  target: perpsTradesHistoryRefreshHookAtom,
  use: usePerpsTradesHistoryRefreshHookAtom,
} = globalAtom<{ refreshHook: number }>({
  name: EAtomNames.perpsTradesHistoryRefreshHookAtom,
  initialValue: { refreshHook: 0 },
});

export interface IPerpsTradesHistoryDataAtom {
  fills: IFill[];
  isLoaded: boolean;
  latestTime: number;
  accountAddress: string | undefined;
}

export const {
  target: perpsTradesHistoryDataAtom,
  use: usePerpsTradesHistoryDataAtom,
} = globalAtom<IPerpsTradesHistoryDataAtom>({
  name: EAtomNames.perpsTradesHistoryDataAtom,
  initialValue: {
    fills: [],
    isLoaded: false,
    latestTime: 0,
    accountAddress: undefined,
  },
});

export const {
  target: perpsCandlesWebviewReloadHookAtom,
  use: usePerpsCandlesWebviewReloadHookAtom,
} = globalAtom<{ reloadHook: number }>({
  name: EAtomNames.perpsCandlesWebviewReloadHookAtom,
  initialValue: { reloadHook: 100 },
});

export const {
  target: perpsCandlesWebviewMountedAtom,
  use: usePerpsCandlesWebviewMountedAtom,
} = globalAtom<{ mounted: boolean }>({
  name: EAtomNames.perpsCandlesWebviewMountedAtom,
  initialValue: { mounted: false },
});

export const {
  target: perpsWebSocketDataUpdateTimesAtom,
  use: usePerpsWebSocketDataUpdateTimesAtom,
} = globalAtom<{
  wsDataReceiveTimes: number;
  wsDataUpdateTimes: number;
}>({
  name: EAtomNames.perpsWebSocketDataUpdateTimesAtom,
  initialValue: { wsDataReceiveTimes: 0, wsDataUpdateTimes: 0 },
});

export interface IPerpsLayoutState {
  main: {
    marketRatio: number;
  };
  leftPanel: {
    chartsRatio: number;
  };
  orderBook: {
    visible: boolean;
  };
  resetAt?: number;
}

export const DEFAULT_PERPS_LAYOUT_STATE: Omit<IPerpsLayoutState, 'resetAt'> = {
  main: { marketRatio: 90 },
  leftPanel: { chartsRatio: 60 },
  orderBook: { visible: true },
};

export const { target: perpsLayoutStateAtom, use: usePerpsLayoutStateAtom } =
  globalAtom<IPerpsLayoutState>({
    name: EAtomNames.perpsLayoutStateAtom,
    persist: true,
    initialValue: DEFAULT_PERPS_LAYOUT_STATE,
  });
