/* eslint-disable @typescript-eslint/no-unused-vars */
import BigNumber from 'bignumber.js';

import { PERPS_ACCOUNT_DISPLAY_CACHE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
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
import {
  EHyperLiquidAbstractionMode,
  EPerpUserType,
  ETriggerOrderType,
} from '@onekeyhq/shared/types/hyperliquid';
import { DEFAULT_PERP_TOKEN_ACTIVE_TAB } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import { EAtomNames } from '../atomNames';
import { globalAtom, globalAtomComputedR } from '../utils';

import type { IPerpDynamicTab } from '../../../services/ServiceWebviewPerp/ServiceWebviewPerp';
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

export interface IPerpsAccountDisplaySnapshotEntry {
  account: IPerpsActiveAccountAtom;
  accountValue: string | undefined;
  withdrawable: string | undefined;
  activeAsset:
    | {
        coin: string;
        leverage: IPerpsActiveAssetData['leverage'] | undefined;
        updatedAt: number;
      }
    | undefined;
  availableToTrade:
    | {
        coin: string;
        value: string;
        updatedAt: number;
      }
    | undefined;
  updatedAt: number;
}

export interface IPerpsAccountDisplaySnapshotAtom {
  entries: Record<string, IPerpsAccountDisplaySnapshotEntry>;
}

export const {
  target: perpsAccountDisplaySnapshotAtom,
  use: usePerpsAccountDisplaySnapshotAtom,
} = globalAtom<IPerpsAccountDisplaySnapshotAtom>({
  name: EAtomNames.perpsAccountDisplaySnapshotAtom,
  persist: true,
  initialValue: {
    entries: {},
  },
});

export function getPerpsAccountDisplaySnapshotEntry({
  snapshot,
  accountAddress,
  indexedAccountId,
  accountId,
  deriveType,
  maxAgeMs = PERPS_ACCOUNT_DISPLAY_CACHE_MAX_AGE_MS,
}: {
  snapshot: IPerpsAccountDisplaySnapshotAtom | undefined;
  accountAddress?: string | null;
  indexedAccountId?: string | null;
  accountId?: string | null;
  deriveType?: IAccountDeriveTypes | null;
  maxAgeMs?: number;
}) {
  const now = Date.now();
  const entries = Object.values(snapshot?.entries ?? {})
    .filter((entry) => now - entry.updatedAt <= maxAgeMs)
    .toSorted((a, b) => b.updatedAt - a.updatedAt);
  const normalizedAddress = accountAddress?.toLowerCase();
  const matchesRequestedAccount = (
    entry: IPerpsAccountDisplaySnapshotEntry,
  ) => {
    const entryAccount = entry.account;
    const hasRequestedAccount = Boolean(indexedAccountId || accountId);
    const isSameAccount =
      Boolean(
        indexedAccountId &&
        entryAccount.indexedAccountId &&
        entryAccount.indexedAccountId === indexedAccountId,
      ) ||
      Boolean(
        accountId &&
        entryAccount.accountId &&
        entryAccount.accountId === accountId,
      );
    const isSameDeriveType =
      !deriveType ||
      !entryAccount.deriveType ||
      entryAccount.deriveType === deriveType;
    return (!hasRequestedAccount || isSameAccount) && isSameDeriveType;
  };

  if (normalizedAddress) {
    const addressEntry = snapshot?.entries?.[normalizedAddress];
    if (
      addressEntry &&
      now - addressEntry.updatedAt <= maxAgeMs &&
      matchesRequestedAccount(addressEntry)
    ) {
      return addressEntry;
    }
  }

  const accountEntry = entries.find((entry) => {
    if (!indexedAccountId && !accountId) {
      return false;
    }
    return matchesRequestedAccount(entry);
  });

  if (accountEntry) {
    return accountEntry;
  }

  return undefined;
}

// #region Abstraction Mode
export type IPerpsAbstractionModeSource = 'live' | 'cache';

export const {
  target: perpsAbstractionModeAtom,
  use: usePerpsAbstractionModeAtom,
} = globalAtom<
  | {
      accountAddress: IHex | undefined;
      mode: EHyperLiquidAbstractionMode | undefined;
      source?: IPerpsAbstractionModeSource;
    }
  | undefined
>({
  name: EAtomNames.perpsAbstractionModeAtom,
  initialValue: undefined,
});
// #endregion

// #region Spot Dusting
const SPOT_DUSTING_LIVE_RECONCILE_GRACE_MS = 15_000;

export type IPerpsSpotDustingAtom =
  | {
      accountAddress: IHex;
      optOut: boolean;
      source: 'live' | 'local';
      updatedAt: number;
      localMutation?: {
        optOut: boolean;
        updatedAt: number;
        ignoreLiveUntil: number;
      };
    }
  | undefined;

export function getPerpsSpotDustingNextState({
  prev,
  accountAddress,
  optOut,
  source,
  updatedAt,
  liveReconcileGraceMs = SPOT_DUSTING_LIVE_RECONCILE_GRACE_MS,
}: {
  prev: IPerpsSpotDustingAtom;
  accountAddress: IHex;
  optOut: boolean;
  source: 'live' | 'local';
  updatedAt: number;
  liveReconcileGraceMs?: number;
}): IPerpsSpotDustingAtom {
  const prevMatchesAccount =
    prev?.accountAddress?.toLowerCase() === accountAddress.toLowerCase();
  const prevLocalMutation = prevMatchesAccount
    ? prev?.localMutation
    : undefined;

  if (
    source === 'live' &&
    prevLocalMutation &&
    prevLocalMutation.optOut !== optOut &&
    updatedAt < prevLocalMutation.ignoreLiveUntil
  ) {
    return prev;
  }

  const localMutation =
    source === 'local'
      ? {
          optOut,
          updatedAt,
          ignoreLiveUntil: updatedAt + liveReconcileGraceMs,
        }
      : undefined;

  if (
    prevMatchesAccount &&
    prev?.optOut === optOut &&
    prev.source === source &&
    prev.localMutation?.optOut === localMutation?.optOut &&
    prev.localMutation?.updatedAt === localMutation?.updatedAt &&
    prev.localMutation?.ignoreLiveUntil === localMutation?.ignoreLiveUntil
  ) {
    return prev;
  }

  return {
    accountAddress,
    optOut,
    source,
    updatedAt,
    localMutation,
  };
}

export const { target: perpsSpotDustingAtom, use: usePerpsSpotDustingAtom } =
  globalAtom<IPerpsSpotDustingAtom>({
    name: EAtomNames.perpsSpotDustingAtom,
    initialValue: undefined,
  });
// #endregion

// #region Spot Balances
export interface ISpotBalanceItem {
  coin: string;
  token: number;
  total: string;
  hold: string;
  entryNtl: string;
}
export const { target: perpsSpotBalancesAtom, use: usePerpsSpotBalancesAtom } =
  globalAtom<
    | {
        accountAddress: IHex | undefined;
        balances: ISpotBalanceItem[];
        spotTotalUsd: string | undefined;
      }
    | undefined
  >({
    name: EAtomNames.perpsSpotBalancesAtom,
    initialValue: undefined,
  });
// #endregion

export const {
  target: perpsComputedAccountValueAtom,
  use: usePerpsComputedAccountValueAtom,
} = globalAtomComputedR<{
  accountValue: string | undefined;
  withdrawable: string | undefined;
  isLoading: boolean;
}>({
  read: (get) => {
    const account = get(perpsActiveAccountAtom.atom());
    const modeData = get(perpsAbstractionModeAtom.atom());
    const summary = get(perpsActiveAccountSummaryAtom.atom());
    const spotData = get(perpsSpotBalancesAtom.atom());

    const activeAddress = account?.accountAddress?.toLowerCase();
    const isSummaryForActiveAccount =
      Boolean(activeAddress) &&
      summary?.accountAddress?.toLowerCase() === activeAddress;
    const isSpotForActiveAccount =
      Boolean(activeAddress) &&
      spotData?.accountAddress?.toLowerCase() === activeAddress;
    const isModeForActiveAccount =
      Boolean(activeAddress) &&
      modeData?.accountAddress?.toLowerCase() === activeAddress;

    const activeSummary = isSummaryForActiveAccount ? summary : undefined;
    const activeSpotData = isSpotForActiveAccount ? spotData : undefined;
    const mode = isModeForActiveAccount ? modeData?.mode : undefined;

    // Mode unknown or DEFAULT: use existing clearinghouse value as fallback, mark loading
    // DEFAULT is treated like disabled (spot+perps) until auto-correction sets it to unified
    if (!mode || mode === EHyperLiquidAbstractionMode.DEFAULT) {
      return {
        accountValue: activeSummary?.accountValue,
        withdrawable: activeSummary?.withdrawable,
        isLoading: true,
      };
    }

    const isUnified =
      mode === EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT ||
      mode === EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN;

    if (isUnified) {
      // Unified/portfolio: account value + withdrawable come from spotState. The
      // per-dex perp clearinghouse summaries (incl. the summed summary.withdrawable)
      // are not meaningful when collateral is shared, and HL's true PM withdrawable
      // is health-factor-capped — a value absent from every feed we fetch. So both
      // modes fall back to the spot-side USDC proxy; do not swap in summary.withdrawable.
      if (activeSpotData?.spotTotalUsd === undefined) {
        // Spot data not yet loaded: return undefined for skeleton screen
        return {
          accountValue: undefined,
          withdrawable: undefined,
          isLoading: true,
        };
      }
      const usdcBalance = activeSpotData.balances?.find((b) => b.token === 0);
      const usdcWithdrawable = usdcBalance
        ? new BigNumber(usdcBalance.total).minus(usdcBalance.hold).toFixed()
        : '0';
      return {
        accountValue: activeSpotData.spotTotalUsd,
        withdrawable: usdcWithdrawable,
        isLoading: false,
      };
    }

    // disabled / dexAbstraction: account value = spot + perps clearinghouse
    const perpsValue = new BigNumber(activeSummary?.accountValue || '0');
    const spotValue = new BigNumber(activeSpotData?.spotTotalUsd || '0');
    return {
      accountValue: spotValue.plus(perpsValue).toFixed(),
      withdrawable: activeSummary?.withdrawable,
      isLoading: activeSpotData?.spotTotalUsd === undefined,
    };
  },
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
  abstractionOk: boolean;
  requiresAgentRemovalSignature?: boolean;
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
    const abstractionMode = get(perpsAbstractionModeAtom.atom());
    const details: IPerpsActiveAccountStatusDetails | undefined =
      status?.accountAddress &&
      status?.accountAddress?.toLowerCase() ===
        account.accountAddress?.toLowerCase()
        ? status.details
        : undefined;

    // statusInfo.abstractionOk is stale until checkPerpsAccountStatus() reruns,
    // prefer WS-pushed mode so canTrade reacts immediately (OK-52729)
    let abstractionOk = details?.abstractionOk;
    if (
      abstractionMode &&
      abstractionMode.source !== 'cache' &&
      abstractionMode.accountAddress?.toLowerCase() ===
        account.accountAddress?.toLowerCase()
    ) {
      abstractionOk =
        abstractionMode.mode === EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT ||
        abstractionMode.mode === EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN;
    }

    const canTrade =
      account?.accountAddress &&
      details?.agentOk &&
      details?.builderFeeOk &&
      details?.referralCodeOk &&
      details?.activatedOk &&
      details?.internalRebateBoundOk &&
      abstractionOk;

    const isReadOnlyAccount = account?.accountId
      ? accountUtils.isWatchingAccount({ accountId: account.accountId })
      : false;
    const accountNotSupport =
      (!account?.accountAddress && !account?.indexedAccountId) ||
      isReadOnlyAccount;
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
    const isAtomReady = Boolean(status?.details?.agentOk && status?.canTrade);
    if (isAtomReady) {
      return { isAgentReady: true };
    }

    return {
      isAgentReady: false,
    };
  },
});

export interface IPerpsAccountLoadingInfo {
  selectAccountLoading: boolean;
  enableTradingLoading: boolean;
  enableTradingTriggered: boolean;
  enableTradingStatusPending: boolean;
}
export const {
  target: perpsAccountLoadingInfoAtom,
  use: usePerpsAccountLoadingInfoAtom,
} = globalAtom<IPerpsAccountLoadingInfo>({
  name: EAtomNames.perpsAccountLoadingInfoAtom,
  initialValue: {
    selectAccountLoading: false,
    enableTradingLoading: false,
    enableTradingTriggered: false,
    enableTradingStatusPending: false,
  },
});

export const {
  target: perpsActiveAccountEnableTradingModeAtom,
  use: usePerpsActiveAccountEnableTradingModeAtom,
} = globalAtomComputedR<{
  isSoftwareAccount: boolean;
  isHardwareAccount: boolean;
  canAutoEnableInOrderPanel: boolean;
  requiresEnableTradingDialogInOrderPanel: boolean;
  requiresExplicitEnableTrading: boolean;
}>({
  read: (get) => {
    const account = get(perpsActiveAccountAtom.atom());

    const accountId = account.accountId ?? account.indexedAccountId;

    if (!accountId) {
      return {
        isSoftwareAccount: false,
        isHardwareAccount: false,
        canAutoEnableInOrderPanel: false,
        requiresEnableTradingDialogInOrderPanel: false,
        requiresExplicitEnableTrading: true,
      };
    }

    const isSoftwareAccount =
      accountUtils.isHdAccount({ accountId }) ||
      accountUtils.isImportedAccount({ accountId });
    const isHardwareAccount = accountUtils.isHwAccount({ accountId });
    const shouldUseOrderPanelEnableTradingDialog =
      isHardwareAccount || !isSoftwareAccount;

    return {
      isSoftwareAccount,
      isHardwareAccount,
      canAutoEnableInOrderPanel: isSoftwareAccount,
      requiresEnableTradingDialogInOrderPanel:
        shouldUseOrderPanelEnableTradingDialog,
      requiresExplicitEnableTrading: !isSoftwareAccount,
    };
  },
});

export const {
  target: perpsShouldShowEnableTradingButtonAtom,
  use: usePerpsShouldShowEnableTradingButtonAtom,
} = globalAtomComputedR<boolean>({
  read: (get) => {
    const status = get(perpsActiveAccountStatusAtom.atom());
    const enableTradingMode = get(
      perpsActiveAccountEnableTradingModeAtom.atom(),
    );

    if (!status?.accountAddress) {
      return true;
    }

    if (status.accountNotSupport || status.canCreateAddress) {
      return true;
    }

    return !(
      status.canTrade ||
      enableTradingMode.canAutoEnableInOrderPanel ||
      enableTradingMode.requiresEnableTradingDialogInOrderPanel
    );
  },
});

// Precise readiness flags for the Perps account display surface. Unlike
// perpsAccountLoadingInfoAtom (whose selectAccountLoading is a fixed 300ms
// timer) these reflect actual per-atom data presence and address alignment,
// so account-value cache hits become "ready" the moment hydrate populates the
// atoms. Trading status still requires live statusInfo.
export interface IPerpsAccountDisplayReadyAtom {
  accountResolved: boolean;
  summaryReady: boolean;
  statusReady: boolean;
}
export const {
  target: perpsAccountDisplayReadyAtom,
  use: usePerpsAccountDisplayReadyAtom,
} = globalAtomComputedR<IPerpsAccountDisplayReadyAtom>({
  read: (get) => {
    const loading = get(perpsAccountLoadingInfoAtom.atom());
    const account = get(perpsActiveAccountAtom.atom());
    const summary = get(perpsActiveAccountSummaryAtom.atom());
    const statusInfo = get(perpsActiveAccountStatusInfoAtom.atom());
    const computedValue = get(perpsComputedAccountValueAtom.atom());

    const activeAddress = account?.accountAddress?.toLowerCase() ?? null;
    // accountResolved tracks the existing 300ms timer so consumers that
    // depend on the legacy "selection settled" notion can opt in to this
    // atom without changing semantics.
    const accountResolved = !loading.selectAccountLoading;

    // Summary is "ready" when we have a finalized accountValue for the
    // current address. Cache hydrate populates summary before the active
    // account is published, so this flips true as soon as activeAccount
    // becomes visible to React.
    const summaryReady = Boolean(
      activeAddress &&
      summary?.accountAddress?.toLowerCase() === activeAddress &&
      computedValue?.isLoading === false &&
      computedValue?.accountValue !== undefined,
    );

    // Status is "ready" only when live statusInfo belongs to the current
    // address. Cached status is intentionally not used by trading guards.
    const statusReady = Boolean(
      activeAddress &&
      statusInfo?.accountAddress?.toLowerCase() === activeAddress,
    );

    return {
      accountResolved,
      summaryReady,
      statusReady,
    };
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
      coin: 'xyz:NVDA',
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

export const {
  target: perpsActiveAssetCtxDisplayAtom,
  use: usePerpsActiveAssetCtxDisplayAtom,
} = globalAtom<IPerpsActiveAssetCtxAtom>({
  name: EAtomNames.perpsActiveAssetCtxDisplayAtom,
  initialValue: undefined,
});

export const {
  target: perpsActiveAssetCtxReadyAtom,
  use: usePerpsActiveAssetCtxReadyAtom,
} = globalAtomComputedR<boolean>({
  read: (get) => Boolean(get(perpsActiveAssetCtxAtom.atom())),
});

export const {
  target: perpsActiveAssetCtxMidPriceAtom,
  use: usePerpsActiveAssetCtxMidPriceAtom,
} = globalAtomComputedR<string | undefined>({
  read: (get) => get(perpsActiveAssetCtxAtom.atom())?.ctx?.midPrice,
});

export type IPerpsActiveAssetCtxMidPriceSource =
  | 'live'
  | 'display'
  | 'disabled';

export const perpsActiveAssetCtxMidPriceBySourceAtomCache = new Map<
  IPerpsActiveAssetCtxMidPriceSource,
  ReturnType<typeof globalAtomComputedR<string | undefined>>
>();

function getOrCreatePerpsActiveAssetCtxMidPriceBySourceAtom(
  source: IPerpsActiveAssetCtxMidPriceSource,
) {
  let entry = perpsActiveAssetCtxMidPriceBySourceAtomCache.get(source);
  if (!entry) {
    entry = globalAtomComputedR<string | undefined>({
      read: (get) => {
        if (source === 'disabled') {
          return undefined;
        }
        const assetCtx =
          source === 'display'
            ? get(perpsActiveAssetCtxDisplayAtom.atom())
            : get(perpsActiveAssetCtxAtom.atom());
        return assetCtx?.ctx?.midPrice;
      },
    });
    perpsActiveAssetCtxMidPriceBySourceAtomCache.set(source, entry);
  }
  return entry;
}

export function usePerpsActiveAssetCtxMidPriceBySource(
  source: IPerpsActiveAssetCtxMidPriceSource,
): string | undefined {
  const { use } = getOrCreatePerpsActiveAssetCtxMidPriceBySourceAtom(source);
  const [midPrice] = use();
  return midPrice;
}

export type IPerpsActiveAssetDataAtom = IPerpsActiveAssetData | undefined;
export const {
  target: perpsActiveAssetDataAtom,
  use: usePerpsActiveAssetDataAtom,
} = globalAtom<IPerpsActiveAssetDataAtom>({
  name: EAtomNames.perpsActiveAssetDataAtom,
  initialValue: undefined,
});

// #region Trading Mode
export type ITradingMode = 'perp' | 'spot';
export const { target: tradingModeAtom, use: useTradingModeAtom } =
  globalAtom<ITradingMode>({
    name: EAtomNames.tradingModeAtom,
    initialValue: 'perp',
  });
// #endregion

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
    activeTab: DEFAULT_PERP_TOKEN_ACTIVE_TAB,
    sortSource: 'default',
    sortSourceTab: undefined,
  },
});

// Token Selector Dynamic Tabs (from server config)
// null = not loaded yet, [] = loaded but server returned no tabs
export const {
  target: perpTokenSelectorTabsAtom,
  use: usePerpTokenSelectorTabsAtom,
} = globalAtom<IPerpDynamicTab[] | null>({
  name: EAtomNames.perpTokenSelectorTabsAtom,
  initialValue: null,
});

export type IPerpFavoritesDisplayMode = 'price' | 'percent';

export interface IPerpTokenFavorites {
  favorites: string[];
  displayMode: IPerpFavoritesDisplayMode;
}

export const {
  target: perpTokenFavoritesPersistAtom,
  use: usePerpTokenFavoritesPersistAtom,
} = globalAtom<IPerpTokenFavorites>({
  name: EAtomNames.perpTokenFavoritesPersistAtom,
  persist: true,
  initialValue: {
    favorites: [],
    displayMode: 'price',
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
  perpConfigLoaded?: boolean;
}
export const {
  target: perpsCommonConfigPersistAtom,
  use: usePerpsCommonConfigPersistAtom,
} = globalAtom<IPerpsCommonConfigPersistAtom>({
  name: EAtomNames.perpsCommonConfigPersistAtom,
  persist: true,
  initialValue: {
    perpConfigCommon: {
      disablePerp: true, // Default to hide perps tab, gated by perpConfigLoaded
    },
    perpConfigLoaded: false,
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

export type IPerpsLastAdvancedOrderType = ETriggerOrderType | 'scale' | 'twap';

export interface IPerpsCustomSettings {
  skipOrderConfirm: boolean;
  showTradeMarks: boolean;
  showChartLines: boolean;
  lastTriggerOrderType: ETriggerOrderType;
  lastAdvancedOrderType?: IPerpsLastAdvancedOrderType;
}
export const {
  target: perpsCustomSettingsAtom,
  use: usePerpsCustomSettingsAtom,
} = globalAtom<IPerpsCustomSettings>({
  name: EAtomNames.perpsCustomSettingsAtom,
  persist: true,
  initialValue: {
    skipOrderConfirm: false,
    showTradeMarks: true,
    showChartLines: true,
    lastTriggerOrderType: ETriggerOrderType.TRIGGER_MARKET,
    lastAdvancedOrderType: ETriggerOrderType.TRIGGER_MARKET,
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
  pingMs?: number | null;
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
  orderBook?: {
    visible: boolean;
  };
  chartExpanded?: boolean;
  resetAt?: number;
}

export const DEFAULT_PERPS_LAYOUT_STATE: IPerpsLayoutState = {
  orderBook: { visible: true },
  chartExpanded: false,
};

export const { target: perpsLayoutStateAtom, use: usePerpsLayoutStateAtom } =
  globalAtom<IPerpsLayoutState>({
    name: EAtomNames.perpsLayoutStateAtom,
    persist: true,
    initialValue: DEFAULT_PERPS_LAYOUT_STATE,
  });

// #region Footer Ticker
export type IPerpsFooterTickerMode = 'popular' | 'favorites' | 'none';

export const {
  target: perpsFooterTickerModePersistAtom,
  use: usePerpsFooterTickerModePersistAtom,
} = globalAtom<{ mode: IPerpsFooterTickerMode }>({
  name: EAtomNames.perpsFooterTickerModePersistAtom,
  persist: true,
  initialValue: {
    mode: 'popular',
  },
});
// #endregion
