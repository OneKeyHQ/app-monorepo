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

export function getTrayWatchlistNativeInfo({
  isNative,
  contractAddress,
}: {
  isNative?: boolean;
  contractAddress?: string;
}) {
  const resolvedIsNative =
    isNative !== undefined ? isNative : (contractAddress?.length ?? 0) < 30;
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
  if (isNative) {
    return {
      screen: ETabMarketRoutes.MarketNativeDetail,
      params: {
        network,
        isNative: true,
      },
    };
  }

  if (!tokenAddress) return undefined;

  return {
    screen: ETabMarketRoutes.MarketDetailV2,
    params: {
      tokenAddress,
      network,
      isNative: false,
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
        const decodedTx = historyTx?.decodedTx;
        const status = decodedTx?.status;
        if (
          historyTx &&
          isTxInActiveAccountScope(historyTx, activeAccountIds) &&
          (status === EDecodedTxStatus.Pending ||
            status === EDecodedTxStatus.Failed)
        ) {
          txs.push(historyTx);
        }
      }
    }
  }

  return txs;
}

export function recoverFailedTrackedTxs(
  rawData: { confirmedTxs?: Record<string, unknown> } | undefined | null,
  trackedPendingIds: Set<string>,
  activeAccountScope: ITrayActiveAccountScope,
): IAccountHistoryTx[] {
  const recovered: IAccountHistoryTx[] = [];
  const activeAccountIds = buildActiveAccountIdSet(activeAccountScope);
  if (
    activeAccountIds.size === 0 ||
    !rawData?.confirmedTxs ||
    trackedPendingIds.size === 0
  )
    return recovered;

  for (const value of Object.values(rawData.confirmedTxs)) {
    if (Array.isArray(value)) {
      for (const tx of value) {
        const historyTx = tx as IAccountHistoryTx | undefined;
        if (
          historyTx &&
          isTxInActiveAccountScope(historyTx, activeAccountIds) &&
          historyTx.decodedTx?.status === EDecodedTxStatus.Failed
        ) {
          const originalId = historyTx.originalId;
          const matched =
            trackedPendingIds.has(historyTx.id) ||
            (typeof originalId === 'string' &&
              trackedPendingIds.has(originalId));
          if (matched) recovered.push(historyTx);
        }
      }
    }
  }

  return recovered;
}
