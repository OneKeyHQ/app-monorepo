import { useEffect, useCallback, useRef } from 'react';

import { useActiveAccountValueAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import type { ITrayData } from '@onekeyhq/shared/src/types/desktop/tray';

/**
 * This hook runs in the MAIN WINDOW renderer only (desktop platform).
 * It listens for data requests from the tray main process
 * and responds with current data.
 */
export function useTrayDataProvider() {
  const [activeAccountValue] = useActiveAccountValueAtom();
  const activeAccountValueRef = useRef(activeAccountValue);
  activeAccountValueRef.current = activeAccountValue;

  const handleTrayDataRequest = useCallback(async () => {
    try {
      const trayData: ITrayData = {
        wallet: { name: '', avatar: '' },
        totalBalance: { amount: '0', currency: 'USD', change24h: 0 },
        watchlist: [],
        pendingTxs: [],
      };

      // 1. Get active wallet info via simpleDb
      try {
        const selectedAccount =
          await backgroundApiProxy.simpleDb.accountSelector.getSelectedAccount({
            sceneName: EAccountSelectorSceneName.home,
            num: 0,
          });

        if (selectedAccount?.walletId) {
          const wallet =
            await backgroundApiProxy.serviceAccount.getWallet({
              walletId: selectedAccount.walletId,
            });
          trayData.wallet.name = wallet?.name || 'Wallet';
        }
      } catch {
        trayData.wallet.name = 'Wallet';
      }

      // 2. Get balance from global atom
      const accountValue = activeAccountValueRef.current;
      if (accountValue) {
        const val = accountValue.value;
        const totalStr =
          typeof val === 'string'
            ? val
            : Object.values(val).reduce(
                (sum, v) => String(Number(sum) + Number(v || 0)),
                '0',
              );
        trayData.totalBalance = {
          amount: totalStr,
          currency: accountValue.currency || 'USD',
          change24h: 0,
        };
      }

      // 3. Market watchlist — try to get favorites with prices
      try {
        const watchListData =
          await backgroundApiProxy.serviceMarketV2.getMarketWatchListV2();
        if (watchListData?.data?.length) {
          // Get coin IDs for price lookup
          const coinIds = watchListData.data
            .slice(0, 10)
            .map(
              (item: any) =>
                item.perpsCoin ||
                `${item.chainId}_${item.contractAddress || 'native'}`,
            );

          // Try to fetch market data for these coins
          try {
            const marketData =
              await backgroundApiProxy.serviceMarketV2.fetchMarketListV2({
                coinIds,
                page: 1,
                pageSize: 10,
              });
            if (marketData?.data?.length) {
              trayData.watchlist = marketData.data.map((coin: any) => ({
                symbol: coin.symbol?.toUpperCase() || '',
                name: coin.name || '',
                icon: coin.image || '',
                price: `$${Number(coin.currentPrice || 0).toLocaleString()}`,
                change24h: coin.priceChangePercentage24h || 0,
              }));
            }
          } catch {
            // Market data fetch failed, show watchlist without prices
          }
        }
      } catch {
        // Watchlist not available
      }

      // 4. Pending transactions — try to get from local history
      try {
        const selectedAccount =
          await backgroundApiProxy.simpleDb.accountSelector.getSelectedAccount({
            sceneName: EAccountSelectorSceneName.home,
            num: 0,
          });
        if (selectedAccount?.accountId && selectedAccount?.networkId) {
          const history =
            await backgroundApiProxy.serviceHistory.getAccountLocalHistoryPendingTxs(
              {
                accountId: selectedAccount.accountId,
                networkId: selectedAccount.networkId,
              },
            );
          if (history?.length) {
            trayData.pendingTxs = history.slice(0, 5).map((tx: any) => ({
              id: tx.decodedTx?.txid || tx.id || '',
              type: 'send' as const,
              to: tx.decodedTx?.to || '',
              amount: tx.decodedTx?.totalFiatValue || '',
              status: 'pending',
            }));
          }
        }
      } catch {
        // Pending tx fetch failed
      }

      (globalThis as any).desktopApi?.sendTrayData(trayData);
    } catch {
      // Fallback: send empty data so panel shows something
      (globalThis as any).desktopApi?.sendTrayData({
        wallet: { name: 'Wallet', avatar: '' },
        totalBalance: { amount: '0', currency: 'USD', change24h: 0 },
        watchlist: [],
        pendingTxs: [],
      });
    }
  }, []);

  useEffect(() => {
    if (!platformEnv.isDesktop) return;

    window.addEventListener('onekey-tray-data-request', handleTrayDataRequest);
    return () => {
      window.removeEventListener(
        'onekey-tray-data-request',
        handleTrayDataRequest,
      );
    };
  }, [handleTrayDataRequest]);
}
