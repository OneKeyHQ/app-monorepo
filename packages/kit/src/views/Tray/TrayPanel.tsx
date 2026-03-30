import { useCallback, useEffect, useState } from 'react';

import { ScrollView, Stack } from '@onekeyhq/components';
import {
  TRAY_IPC,
  type ITrayData,
  type ITrayWatchlistItem,
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
  (globalThis as any).desktopApi?.sendTrayAction(action);
}

export function TrayPanel() {
  const [data, setData] = useState<ITrayData | null>(null);

  useEffect(() => {
    const handler = (_event: any, trayData: ITrayData) => {
      setData(trayData);
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    (globalThis as any).desktopApi?.addIpcEventListener(
      TRAY_IPC.UPDATE,
      handler,
    );

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      (globalThis as any).desktopApi?.removeIpcEventListener(
        TRAY_IPC.UPDATE,
        handler,
      );
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

  if (!data) {
    return <TrayEmptyState type="loading" />;
  }

  if (data.isLocked) {
    return (
      <TrayEmptyState
        type="locked"
        onPress={() => handleNavigate('/main/tab-home')}
      />
    );
  }

  if (!data.wallet?.name) {
    return <TrayEmptyState type="noWallet" />;
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
