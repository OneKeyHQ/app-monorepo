import { useEffect, useCallback, useRef } from 'react';

import { useActiveAccountValueAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import type { ITrayData } from '@onekeyhq/shared/src/types/desktop/tray';

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

      // 1. Wallet info
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

      // 2. Balance (from global atom, already formatted as total)
      const accountValue = activeAccountValueRef.current;
      if (accountValue) {
        const val = accountValue.value;
        let totalNum = 0;
        if (typeof val === 'string') {
          totalNum = Number(val) || 0;
        } else if (val && typeof val === 'object') {
          totalNum = Object.values(val).reduce(
            (sum, v) => sum + (Number(v) || 0),
            0,
          );
        }
        trayData.totalBalance = {
          amount: totalNum.toFixed(2),
          currency: accountValue.currency || 'USD',
          change24h: 0,
        };
      }

      // 3. Watchlist with prices
      try {
        const watchListData =
          await backgroundApiProxy.serviceMarketV2.getMarketWatchListV2();
        console.log('[TrayDataProvider] watchListData:', JSON.stringify(watchListData));
        if (watchListData?.data?.length) {
          const spotItems = watchListData.data.filter(
            (item: any) => !item.perpsCoin && item.chainId,
          );
          const perpsItems = watchListData.data.filter(
            (item: any) => !!item.perpsCoin,
          );
          console.log('[TrayDataProvider] spotItems:', spotItems.length, 'perpsItems:', perpsItems.length);
          if (spotItems.length > 0) {
            const tokenAddressList = spotItems.slice(0, 10).map(
              (item: any) => ({
                chainId: item.chainId,
                contractAddress: item.contractAddress || '',
                isNative: item.isNative ?? false,
              }),
            );
            const response =
              await backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch(
                { tokenAddressList },
              );
            if (response?.list?.length) {
              trayData.watchlist = response.list
                .filter((coin: any) => coin?.symbol)
                .map((coin: any) => ({
                  symbol: (coin.symbol || '').toUpperCase(),
                  name: coin.name || '',
                  icon: coin.logoUrl || '',
                  price: `$${Number(coin.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  change24h: coin.priceChangePercentage24H || 0,
                }));
            }
          }
        }
      } catch (e) {
        console.error('[TrayDataProvider] watchlist error:', e);
      }

      // 4. Pending transactions
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
        // Pending tx fetch failed silently
      }

      (globalThis as any).desktopApi?.sendTrayData(trayData);
    } catch {
      (globalThis as any).desktopApi?.sendTrayData({
        wallet: { name: 'Wallet', avatar: '' },
        totalBalance: { amount: '0.00', currency: 'USD', change24h: 0 },
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
