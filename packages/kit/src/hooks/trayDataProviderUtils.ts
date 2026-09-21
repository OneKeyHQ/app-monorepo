import BigNumber from 'bignumber.js';

import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes/tabMarket';
import type { ITrayWatchlistItem } from '@onekeyhq/shared/src/types/desktop/tray';
import { calculateAccountTotalValue } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

type ITrayNetworkInfoMap = Record<
  string,
  {
    deriveType: string;
    mergeDeriveAssetsEnabled: boolean;
  }
>;

type ITrayWatchlistSourceItem = {
  chainId?: string;
  contractAddress?: string;
  isNative?: boolean;
  perpsCoin?: string;
  assetId?: string;
  stockId?: string;
};

type ITrayWatchlistResolvedItem = {
  sourceItem: ITrayWatchlistSourceItem;
  item: ITrayWatchlistItem;
};

export const TRAY_DATA_REFRESH_EVENT_NAMES = [
  EAppEventBusNames.HistoryTxStatusChanged,
  EAppEventBusNames.RefreshHistoryList,
  EAppEventBusNames.AccountDataUpdate,
  EAppEventBusNames.MarketWatchListV2Changed,
  EAppEventBusNames.EnabledNetworksChanged,
  // Without this, tray stays stale when home polling (not tray) confirms a pending tx.
  EAppEventBusNames.LocalPendingTxConfirmed,
] as const;

export function getTrayCurrencyDisplayInfo({
  currencyInfo,
  currencyMap,
}: {
  currencyInfo?: {
    id?: string;
    symbol?: string;
  };
  currencyMap?: Record<string, ICurrencyItem>;
}) {
  const displayCurrency = currencyInfo?.id || 'usd';
  const targetCurrencyInfo = currencyMap?.[displayCurrency];
  const displaySymbol = currencyInfo?.symbol || targetCurrencyInfo?.unit || '$';
  const usdToTargetFactor =
    displayCurrency === 'usd' ? '1' : targetCurrencyInfo?.value || '1';

  return {
    displayCurrency,
    displaySymbol,
    usdToTargetFactor: new BigNumber(usdToTargetFactor),
  };
}

export function formatTrayUsdPrice(usdPrice: BigNumber.Value): string {
  return `$${new BigNumber(usdPrice || 0).toFormat(2)}`;
}

// Same placeholder the Market watchlist renders for a row without a quote.
export const TRAY_QUOTE_PLACEHOLDER = '--';

// Mirrors Market's normalizeStockMetadataValue: listing quotes may omit a
// field or carry a non-numeric marker such as ' - ', and both mean "no data".
function normalizeTrayQuoteValue(
  value?: string | number | null,
): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  const stringValue = typeof value === 'string' ? value.trim() : String(value);
  if (!stringValue) {
    return undefined;
  }
  if (!Number.isFinite(Number(stringValue))) {
    return undefined;
  }
  return stringValue;
}

// A halted, delisted, or pre-market listing favorite legitimately has no
// price/change. Keep that state visible instead of inventing `$0.00 / +0.00%`,
// which is indistinguishable from an asset that really fell to zero.
export function buildTrayListingQuoteDisplay({
  price,
  priceChange24hPercent,
}: {
  price?: string | number | null;
  priceChange24hPercent?: string | number | null;
}): Pick<ITrayWatchlistItem, 'price' | 'change24h'> {
  const priceRaw = normalizeTrayQuoteValue(price);
  const changeRaw = normalizeTrayQuoteValue(priceChange24hPercent);
  return {
    price:
      priceRaw === undefined
        ? TRAY_QUOTE_PLACEHOLDER
        : formatTrayUsdPrice(priceRaw),
    change24h: changeRaw === undefined ? undefined : Number(changeRaw),
  };
}

export function getTrayWatchlistNativeInfo({
  isNative,
  contractAddress,
}: {
  isNative?: boolean;
  contractAddress?: string;
}) {
  const hasContractAddress = !!contractAddress;
  const resolvedIsNative =
    !hasContractAddress ||
    (isNative !== undefined ? isNative : (contractAddress?.length ?? 0) < 30);
  return {
    isNative: resolvedIsNative,
    tokenAddress: resolvedIsNative ? '' : contractAddress || '',
    normalizedTokenAddress: resolvedIsNative
      ? ''
      : (contractAddress || '').toLowerCase(),
  };
}

function getTrayWatchlistSourceKey(
  item: ITrayWatchlistSourceItem,
): string | undefined {
  if (item.perpsCoin) {
    return `perps:${item.perpsCoin.toUpperCase()}`;
  }
  if (item.assetId) {
    return `asset:${item.assetId}`;
  }
  if (item.stockId) {
    return `stock:${item.stockId.toUpperCase()}`;
  }
  if (!item.chainId) return undefined;
  const { normalizedTokenAddress } = getTrayWatchlistNativeInfo({
    isNative: item.isNative,
    contractAddress: item.contractAddress,
  });
  return `spot:${item.chainId}:${normalizedTokenAddress}`;
}

export function buildTrayWatchlistInSourceOrder({
  sourceItems,
  resolvedItems,
}: {
  sourceItems: ITrayWatchlistSourceItem[];
  resolvedItems: ITrayWatchlistResolvedItem[];
}): ITrayWatchlistItem[] {
  const buckets = new Map<string, ITrayWatchlistItem[]>();

  for (const { sourceItem, item } of resolvedItems) {
    const key = getTrayWatchlistSourceKey(sourceItem);
    if (key) {
      const bucket = buckets.get(key) ?? [];
      bucket.push(item);
      buckets.set(key, bucket);
    }
  }

  const orderedItems: ITrayWatchlistItem[] = [];
  for (const sourceItem of sourceItems) {
    const key = getTrayWatchlistSourceKey(sourceItem);
    if (key) {
      const item = buckets.get(key)?.shift();
      if (item) orderedItems.push(item);
    }
  }

  return orderedItems;
}

export function getTrayMarketNavigationTarget({
  network,
  tokenAddress,
  isNative,
}: {
  network: string;
  tokenAddress?: string;
  isNative?: boolean;
}):
  | {
      screen: ETabMarketRoutes;
      params: {
        network: string;
        tokenAddress?: string;
        isNative?: boolean;
      };
    }
  | undefined {
  // Natives without an address (EVM/BTC/SOL) only resolve on the native
  // route. Natives that do carry one (Move type tags such as `0x2::sui::SUI`)
  // must keep it: the token route is what the Market list opens for them, and
  // the detail identity check fails without the address (OK-63847).
  if (!tokenAddress) {
    return {
      screen: ETabMarketRoutes.MarketNativeDetail,
      params: {
        network,
        isNative: true,
      },
    };
  }

  return {
    screen: ETabMarketRoutes.MarketDetailV2,
    params: {
      tokenAddress,
      network,
      isNative: Boolean(isNative),
    },
  };
}

export function getTrayTokenValueInTargetCurrency({
  tokensValue,
  usdToTargetFactor,
  walletId,
  enabledNetworksCompatibleWithWalletId,
  networkInfoMap,
}: {
  tokensValue: string | Record<string, string> | undefined;
  usdToTargetFactor: BigNumber.Value;
  walletId?: string;
  enabledNetworksCompatibleWithWalletId?: Array<{ id: string }>;
  networkInfoMap?: ITrayNetworkInfoMap;
}) {
  const hasEnabledNetworkScope =
    !!walletId &&
    !!enabledNetworksCompatibleWithWalletId?.length &&
    !!networkInfoMap &&
    Object.keys(networkInfoMap).length > 0;

  const tokensUsd = calculateAccountTotalValue({
    tokensValue,
    deFiNetWorth: 0,
    ...(hasEnabledNetworkScope
      ? {
          walletId,
          enabledNetworksCompatibleWithWalletId,
          networkInfoMap,
        }
      : undefined),
  });

  return new BigNumber(tokensUsd ?? '0')
    .times(new BigNumber(usdToTargetFactor || 1))
    .toFixed();
}

export type ITrayActiveAccountScope = {
  accountIds?: Array<string | undefined>;
};

function buildActiveAccountIdSet(scope: ITrayActiveAccountScope): Set<string> {
  const accountIds = new Set<string>();
  scope.accountIds?.forEach((accountId) => {
    if (accountId) accountIds.add(accountId);
  });

  return accountIds;
}

function isTxInActiveAccountScope(
  tx: IAccountHistoryTx | undefined,
  activeAccountIds: Set<string>,
) {
  const accountId = tx?.decodedTx?.accountId;
  return !!accountId && activeAccountIds.has(accountId);
}

export function collectTrayTrackedTxs(
  rawData: { pendingTxs?: Record<string, unknown> } | undefined | null,
  activeAccountScope: ITrayActiveAccountScope,
): IAccountHistoryTx[] {
  const txs: IAccountHistoryTx[] = [];
  const activeAccountIds = buildActiveAccountIdSet(activeAccountScope);
  if (activeAccountIds.size === 0 || !rawData?.pendingTxs) return txs;

  for (const value of Object.values(rawData.pendingTxs)) {
    if (Array.isArray(value)) {
      for (const tx of value) {
        const historyTx = tx as IAccountHistoryTx | undefined;
        if (
          historyTx &&
          isTxInActiveAccountScope(historyTx, activeAccountIds) &&
          historyTx.decodedTx?.status === EDecodedTxStatus.Pending
        ) {
          txs.push(historyTx);
        }
      }
    }
  }

  return txs;
}
