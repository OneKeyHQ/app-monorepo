import { useCallback, useEffect, useState } from 'react';

import { ScrollView, Stack } from '@onekeyhq/components';
import {
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

export function TrayPanel() {
  const [data, setData] = useState<ITrayData | null>(null);

  useEffect(() => {
    const handler = (trayData: ITrayData) => {
      setData(trayData);
    };

    // `removeIpcEventListener` is a no-op in the main preload — only the
    // unsubscribe function returned here actually detaches the listener.
    const unsubscribe = globalThis.desktopApi?.addIpcEventListener(
      TRAY_IPC.UPDATE,
      handler as (...args: unknown[]) => void,
    );

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

  const handleTickerPress = useCallback((ticker: ITrayWatchlistItem) => {
    sendTrayAction({
      type: 'market-detail-v2',
      tokenAddress: ticker.tokenAddress || '',
      networkId: ticker.networkId || '',
      isNative: ticker.isNative || false,
      perpsCoin: ticker.perpsCoin || '',
    });
  }, []);

  const hasWatchlist = data?.watchlist && data.watchlist.length > 0;
  // Failed txs are tracked for notifications but don't count as content.
  const hasPendingTxs =
    data?.pendingTxs?.some((tx) => tx.status === 'pending') ?? false;
  const hasContent = hasWatchlist || hasPendingTxs;

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
          onPress={() => handleNavigate('/main/tab-home')}
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
        totalBalance={data.totalBalance}
        onPress={() => handleNavigate('/main/tab-home')}
      />
      {hasContent ? (
        <ScrollView flex={1}>
          <WatchlistTickers
            tickers={data.watchlist}
            onTickerPress={handleTickerPress}
          />
          <PendingTransactions
            transactions={data.pendingTxs}
            onTxPress={(txId) => handleNavigate(`/transaction/${txId}`)}
            onViewAll={handleViewAllTransactions}
          />
        </ScrollView>
      ) : (
        <TrayEmptyState
          type="noContent"
          onPress={() => handleNavigate('/main/tab-home')}
        />
      )}
    </Stack>
  );
}
