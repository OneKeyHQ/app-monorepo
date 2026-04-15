import { useCallback, useEffect, useState } from 'react';

import { ScrollView, Stack } from '@onekeyhq/components';
import {
  type ITrayData,
  type ITrayWatchlistItem,
  TRAY_IPC,
} from '@onekeyhq/shared/src/types/desktop/tray';

import { PendingTransactions } from './components/PendingTransactions';
import { PortfolioOverview } from './components/PortfolioOverview';
import { TrayEmptyState } from './components/TrayEmptyState';
import { WatchlistTickers } from './components/WatchlistTickers';

interface ITrayAction {
  type: string;
  route?: string;
  tokenAddress?: string;
  networkId?: string;
  isNative?: boolean;
  perpsCoin?: string;
}

function sendTrayAction(action: ITrayAction) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  (globalThis as any).desktopApi?.sendTrayAction(action);
}

export function TrayPanel() {
  const [data, setData] = useState<ITrayData | null>(null);

  useEffect(() => {
    // addIpcEventListener strips the IpcRendererEvent, so the listener
    // receives the payload directly as its first (and only) argument.
    const handler = (trayData: ITrayData) => {
      setData(trayData);
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const unsubscribe = (globalThis as any).desktopApi?.addIpcEventListener(
      TRAY_IPC.UPDATE,
      handler,
    );

    return () => {
      // `removeIpcEventListener` is a documented no-op in the main preload;
      // we must use the unsubscribe function returned by addIpcEventListener.
      if (typeof unsubscribe === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        unsubscribe();
      }
    };
  }, []);

  const handleNavigate = useCallback((route: string) => {
    sendTrayAction({ type: 'open-page', route });
  }, []);

  const handleTickerPress = useCallback((ticker: ITrayWatchlistItem) => {
    // Send structured navigation action — main window renderer handles routing
    sendTrayAction({
      type: 'market-detail-v2',
      tokenAddress: ticker.tokenAddress || '',
      networkId: ticker.networkId || '',
      isNative: ticker.isNative || false,
      perpsCoin: ticker.perpsCoin || '',
    });
  }, []);

  const hasWatchlist = data?.watchlist && data.watchlist.length > 0;
  const hasPendingTxs = data?.pendingTxs && data.pendingTxs.length > 0;
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
