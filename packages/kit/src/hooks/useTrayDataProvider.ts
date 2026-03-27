import { useEffect, useCallback, useRef } from 'react';

import { useActiveAccountValueAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { rootNavigationRef } from '@onekeyhq/components/src/layouts/Navigation/Navigator/NavigationContainer';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes/tabMarket';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { TRAY_IPC } from '@onekeyhq/shared/src/types/desktop/tray';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import type {
  ITrayData,
  ITrayWatchlistItem,
} from '@onekeyhq/shared/src/types/desktop/tray';

export function useTrayDataProvider() {
  const [activeAccountValue] = useActiveAccountValueAtom();
  const activeAccountValueRef = useRef(activeAccountValue);
  activeAccountValueRef.current = activeAccountValue;

  const handleTrayDataRequest = useCallback(async () => {
    try {
      const trayData: ITrayData = {
        wallet: { name: '', emoji: '', avatarImg: '' },
        totalBalance: { amount: '0.00', currency: 'USD', change24h: 0 },
        watchlist: [],
        pendingTxs: [],
      };

      // 1. Wallet name + emoji
      let selectedAccount: any;
      try {
        selectedAccount =
          await backgroundApiProxy.simpleDb.accountSelector.getSelectedAccount({
            sceneName: EAccountSelectorSceneName.home,
            num: 0,
          });
        if (selectedAccount?.walletId) {
          const wallet = await backgroundApiProxy.serviceAccount.getWallet({
            walletId: selectedAccount.walletId,
          });
          trayData.wallet.name = wallet?.name || 'Wallet';
          // Parse emoji from avatar (stringified IAvatarInfo)
          if (wallet?.avatar) {
            try {
              const avatarInfo = JSON.parse(wallet.avatar);
              if (avatarInfo?.emoji && avatarInfo.emoji !== 'img') {
                trayData.wallet.emoji = avatarInfo.emoji;
              }
              if (avatarInfo?.img) {
                trayData.wallet.avatarImg = avatarInfo.img;
              }
            } catch {
              // avatar is not JSON
            }
          }
          // Fallback emoji by wallet type (only if no avatar image)
          if (!trayData.wallet.emoji && !trayData.wallet.avatarImg) {
            if (wallet?.type === 'watching') {
              trayData.wallet.emoji = '👁';
            } else if (wallet?.type === 'hw') {
              trayData.wallet.emoji = '🔑';
            } else {
              trayData.wallet.emoji = '💰';
            }
          }
        }
      } catch {
        trayData.wallet.name = 'Wallet';
      }

      // 2. Balance
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

      // 3. Watchlist — both spot and perps
      try {
        const watchListData =
          await backgroundApiProxy.serviceMarketV2.getMarketWatchListV2();
        if (watchListData?.data?.length) {
          const spotItems = watchListData.data.filter(
            (item: any) => !item.perpsCoin && item.chainId,
          );
          const perpsItems = watchListData.data.filter(
            (item: any) => !!item.perpsCoin,
          );

          const watchlistResults: ITrayWatchlistItem[] = [];

          // Fetch spot token data
          if (spotItems.length > 0) {
            try {
              const tokenAddressList = spotItems.map((item: any) => ({
                chainId: item.chainId,
                contractAddress: item.contractAddress || '',
                isNative: item.isNative ?? false,
              }));
              const response =
                await backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch(
                  { tokenAddressList },
                );
              if (response?.list?.length) {
                response.list.forEach((coin: any, idx: number) => {
                  if (!coin?.symbol) return;
                  const spotItem = spotItems[idx];
                  watchlistResults.push({
                    symbol: (coin.symbol || '').toUpperCase(),
                    name: coin.name || '',
                    icon: coin.logoUrl || '',
                    price: `$${Number(coin.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    change24h: Number(coin.priceChange24hPercent || 0),
                    type: 'spot',
                    tokenAddress: coin.address || spotItem?.contractAddress || '',
                    networkId: coin.networkId || spotItem?.chainId || '',
                    isNative: spotItem?.isNative ?? false,
                  });
                });
              }
            } catch {
              // spot fetch failed
            }
          }

          // Fetch perps token data
          if (perpsItems.length > 0) {
            try {
              const perpsData =
                await backgroundApiProxy.serviceMarketV2.fetchMarketPerpsTokenList(
                  { category: 'all' },
                );
              if (perpsData?.tokens?.length) {
                for (const item of perpsItems) {
                  const coin = perpsData.tokens.find(
                    (t: any) =>
                      t.name?.toUpperCase() === item.perpsCoin?.toUpperCase(),
                  );
                  if (coin) {
                    watchlistResults.push({
                      symbol: (coin.name || '').toUpperCase(),
                      name: coin.displayName || coin.name || '',
                      icon: coin.tokenImageUrl || '',
                      price: `$${Number(coin.markPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                      change24h: coin.change24hPercent || 0,
                      type: 'perps',
                      perpsCoin: item.perpsCoin,
                    });
                  }
                }
              }
            } catch {
              // perps fetch failed
            }
          }

          trayData.watchlist = watchlistResults;
        }
      } catch (e) {
        console.error('[TrayDataProvider] watchlist error:', e);
      }

      // 4. Pending transactions
      try {
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
        // pending tx fetch failed
      }

      (globalThis as any).desktopApi?.sendTrayData(trayData);
    } catch {
      (globalThis as any).desktopApi?.sendTrayData({
        wallet: { name: 'Wallet', emoji: '', avatarImg: '' },
        totalBalance: { amount: '0.00', currency: 'USD', change24h: 0 },
        watchlist: [],
        pendingTxs: [],
      });
    }
  }, []);

  // Handle tray navigation events — navigate within main window
  const handleTrayNavigation = useCallback((_event: any, action: any) => {
    const nav = rootNavigationRef.current;
    if (!nav) return;

    if (action?.type === 'market-detail-v2' && action.tokenAddress && action.networkId) {
      nav.navigate(ERootRoutes.Main, {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketDetailV2,
          params: {
            tokenAddress: action.tokenAddress,
            network: action.networkId,
            isNative: action.isNative || false,
          },
        },
      });
    }
  }, []);

  useEffect(() => {
    if (!platformEnv.isDesktop) return;

    window.addEventListener('onekey-tray-data-request', handleTrayDataRequest);
    (globalThis as any).desktopApi?.addIpcEventListener(
      TRAY_IPC.ACTION,
      handleTrayNavigation,
    );

    return () => {
      window.removeEventListener(
        'onekey-tray-data-request',
        handleTrayDataRequest,
      );
      (globalThis as any).desktopApi?.removeIpcEventListener(
        TRAY_IPC.ACTION,
        handleTrayNavigation,
      );
    };
  }, [handleTrayDataRequest, handleTrayNavigation]);
}
