import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Stack } from '@onekeyhq/components';
import { TRAY_IPC, type ITrayData, type ITrayWatchlistItem } from '@onekeyhq/shared/src/types/desktop/tray';
import { TrayEmptyState } from './components/TrayEmptyState';
import { PortfolioOverview } from './components/PortfolioOverview';
import { WatchlistTickers } from './components/WatchlistTickers';
import { PendingTransactions } from './components/PendingTransactions';

function sendTrayAction(action: { type: string; route?: string }) {
  (globalThis as any).desktopApi?.sendTrayAction(action);
}

export function TrayPanel() {
  const [data, setData] = useState<ITrayData | null>(null);

  useEffect(() => {
    const handler = (_event: any, trayData: ITrayData) => {
      setData(trayData);
    };

    (globalThis as any).desktopApi?.addIpcEventListener(TRAY_IPC.UPDATE, handler);

    return () => {
      (globalThis as any).desktopApi?.removeIpcEventListener(TRAY_IPC.UPDATE, handler);
    };
  }, []);

  const handleNavigate = useCallback((route: string) => {
    sendTrayAction({ type: 'open-page', route });
  }, []);

  const handleTickerPress = useCallback(
    (ticker: ITrayWatchlistItem) => {
      if (ticker.type === 'perps' && ticker.perpsCoin) {
        // Navigate to perps detail
        handleNavigate(`/market/perps/${ticker.perpsCoin}`);
      } else if (ticker.tokenAddress && ticker.networkId) {
        // Navigate to spot market detail V2
        handleNavigate(
          `/market/detail?tokenAddress=${encodeURIComponent(ticker.tokenAddress)}&network=${encodeURIComponent(ticker.networkId)}&isNative=${ticker.isNative || false}`,
        );
      }
    },
    [handleNavigate],
  );

  if (!data) {
    return <TrayEmptyState type="loading" />;
  }

  if (!data.wallet?.name) {
    return <TrayEmptyState type="noWallet" />;
  }

  return (
    <Stack flex={1} backgroundColor="$bgApp" borderRadius="$3" overflow="hidden">
      <PortfolioOverview
        wallet={data.wallet}
        totalBalance={data.totalBalance}
        onPress={() => handleNavigate('/main/tab-home')}
      />
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
    </Stack>
  );
}
