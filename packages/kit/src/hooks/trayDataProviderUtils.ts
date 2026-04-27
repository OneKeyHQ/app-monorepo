import BigNumber from 'bignumber.js';

import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBus';
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

export function collectTrayTrackedTxs(
  rawData: { pendingTxs?: Record<string, unknown> } | undefined | null,
): IAccountHistoryTx[] {
  const txs: IAccountHistoryTx[] = [];
  if (!rawData?.pendingTxs) return txs;

  for (const value of Object.values(rawData.pendingTxs)) {
    if (Array.isArray(value)) {
      for (const tx of value) {
        const historyTx = tx as IAccountHistoryTx | undefined;
        const status = historyTx?.decodedTx?.status;
        if (
          historyTx &&
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
): IAccountHistoryTx[] {
  const recovered: IAccountHistoryTx[] = [];
  if (!rawData?.confirmedTxs || trackedPendingIds.size === 0) return recovered;

  for (const value of Object.values(rawData.confirmedTxs)) {
    if (Array.isArray(value)) {
      for (const tx of value) {
        const historyTx = tx as IAccountHistoryTx | undefined;
        if (
          historyTx &&
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
