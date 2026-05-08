import { useCallback, useEffect, useState } from 'react';

import { ScrollView, Stack } from '@onekeyhq/components';
import {
  type IPendingTx,
  type ITrayAction,
  type ITrayData,
  type ITrayWatchlistItem,
  TRAY_IPC,
} from '@onekeyhq/shared/src/types/desktop/tray';

import { PendingTransactions } from './components/PendingTransactions';
import { PortfolioOverview } from './components/PortfolioOverview';
import { TrayEmptyState } from './components/TrayEmptyState';
import { WatchlistTickers } from './components/WatchlistTickers';

function sendTrayAction(action: ITrayAction) {
  // Only exposed on the tray-window preload; undefined elsewhere.
  globalThis.desktopApi?.sendTrayAction?.(action);
}

const TRAY_ROUTE_HOME = '/main/tab-home';
const TRAY_ROUTE_MARKET = '/main/tab-market';

export function TrayPanel() {
  const [data, setData] = useState<ITrayData | null>(null);

  useEffect(() => {
    // `removeIpcEventListener` is a no-op in the main preload — only the
    // unsubscribe function returned here actually detaches the listener.
    const unsubscribe = globalThis.desktopApi?.addIpcEventListener(
      TRAY_IPC.UPDATE,
      setData as (...args: unknown[]) => void,
    );

    // Must fire after the listener is attached; main replies synchronously
    // with cached data (or triggers a gather) so the panel doesn't stall
    // on the loading placeholder.
    globalThis.desktopApi?.sendTrayReady?.();

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const handleNavigate = useCallback((route: string) => {
    sendTrayAction({ type: 'open-page', route });
  }, []);

  const handleViewAllTransactions = useCallback(() => {
    sendTrayAction({ type: 'view-all-transactions' });
  }, []);

  const handleTransactionPress = useCallback((tx: IPendingTx) => {
    sendTrayAction({
      type: 'transaction-detail',
      txid: tx.id,
      historyId: tx.historyId,
      accountId: tx.accountId,
      networkId: tx.networkId,
    });
  }, []);

  const handleTickerPress = useCallback((ticker: ITrayWatchlistItem) => {
    sendTrayAction({
      type: 'market-detail-v2',
      tokenAddress: ticker.tokenAddress || '',
      networkId: ticker.networkId || '',
      isNative: ticker.isNative || false,
      perpsCoin: ticker.perpsCoin || '',
    });
  }, []);

  const hasPendingTxs = (data?.pendingTxs?.length ?? 0) > 0;

  if (!data) {
    return (
      <Stack flex={1} backgroundColor="$bgApp" borderRadius="$3">
        <TrayEmptyState type="loading" />
      </Stack>
    );
  }

  if (data.isLocked) {
    return (
      <Stack flex={1} backgroundColor="$bgApp" borderRadius="$3">
        <TrayEmptyState
          type="locked"
          onPress={() => handleNavigate(TRAY_ROUTE_HOME)}
        />
      </Stack>
    );
  }

  if (!data.wallet?.name) {
    return (
      <Stack flex={1} backgroundColor="$bgApp" borderRadius="$3">
        <TrayEmptyState type="noWallet" />
      </Stack>
    );
  }

  return (
    <Stack
      flex={1}
      backgroundColor="$bgApp"
      borderRadius="$3"
      overflow="hidden"
    >
      <PortfolioOverview
        wallet={data.wallet}
        account={data.account}
        totalBalance={data.totalBalance}
        onPress={() => handleNavigate(TRAY_ROUTE_HOME)}
      />
      <ScrollView flex={1}>
        <WatchlistTickers
          tickers={data.watchlist}
          onTickerPress={handleTickerPress}
          onEmptyPress={() => handleNavigate(TRAY_ROUTE_MARKET)}
        />
        {hasPendingTxs ? (
          <PendingTransactions
            transactions={data.pendingTxs}
            onTxPress={handleTransactionPress}
            onViewAll={handleViewAllTransactions}
          />
        ) : null}
      </ScrollView>
    </Stack>
  );
}
