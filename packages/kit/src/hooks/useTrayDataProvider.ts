import { useCallback, useEffect, useRef } from 'react';

import { rootNavigationRef } from '@onekeyhq/components/src/layouts/Navigation/Navigator/NavigationContainer';
import {
  useActiveAccountValueAtom,
  useAppIsLockedAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes/tabMarket';
import { TRAY_IPC } from '@onekeyhq/shared/src/types/desktop/tray';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import type {
  ITrayData,
  ITrayWatchlistItem,
} from '@onekeyhq/shared/src/types/desktop/tray';

export function useTrayDataProvider() {
  const [activeAccountValue] = useActiveAccountValueAtom();
  const [appIsLocked] = useAppIsLockedAtom();
  const activeAccountValueRef = useRef(activeAccountValue);
  activeAccountValueRef.current = activeAccountValue;
  const appIsLockedRef = useRef(appIsLocked);
  appIsLockedRef.current = appIsLocked;
  const handleTrayDataRequestRef = useRef<(() => void) | undefined>(undefined);

  const handleTrayDataRequest = useCallback(async () => {
    // When locked, send empty data with isLocked flag to protect sensitive info
    if (appIsLockedRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      (globalThis as any).desktopApi?.sendTrayData({
        isLocked: true,
        wallet: { name: '', emoji: '', avatarImg: '' },
        totalBalance: { amount: '0.00', currency: 'USD', change24h: 0 },
        watchlist: [],
        pendingTxs: [],
      });
      return;
    }

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
      } catch (e) {
        console.warn('[TrayDataProvider] wallet info error:', e);
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
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                response.list.forEach((coin: any, idx: number) => {
                  if (!coin?.symbol) return;
                  const spotItem = spotItems[idx];
                  watchlistResults.push({
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    symbol: (coin.symbol || '').toUpperCase(),
                    name: coin.name || '',
                    icon: coin.logoUrl || '',
                    price: `$${Number(coin.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    change24h: Number(coin.priceChange24hPercent || 0),
                    type: 'spot',
                    tokenAddress:
                      coin.address || spotItem?.contractAddress || '',
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
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                  const coin = perpsData.tokens.find(
                    (t: any) =>
                      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
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

      // 4. Pending transactions — read directly from simpleDb raw data
      try {
        const rawData =
          await backgroundApiProxy.simpleDb.localHistory.getRawData();
        const allPendingTxs: any[] = [];
        if (rawData?.pendingTxs) {
          for (const txs of Object.values(rawData.pendingTxs)) {
            if (Array.isArray(txs)) {
              for (const tx of txs) {
                if (tx?.decodedTx?.status === EDecodedTxStatus.Pending) {
                  allPendingTxs.push(tx);
                }
              }
            }
          }
        }
        // Sort by most recent first
        allPendingTxs.sort(
          (a, b) =>
            (b.decodedTx?.createdAt || 0) - (a.decodedTx?.createdAt || 0),
        );
        const history = allPendingTxs;
        if (history?.length) {
          trayData.pendingTxs = history.map((tx: any) => {
            const decodedTx = tx.decodedTx;
            const action = decodedTx?.actions?.[0];
            const transfer = action?.assetTransfer;

            // Determine tx type from action
            let txType: 'send' | 'swap' | 'contract' | 'approve' = 'send';
            if (action?.type === 'INTERNAL_SWAP' || transfer?.isInternalSwap) {
              txType = 'swap';
            } else if (action?.type === 'TOKEN_APPROVE') {
              txType = 'approve';
            } else if (action?.type === 'ASSET_TRANSFER') {
              txType = 'send';
            }

            // Get amount + symbol from first send transfer
            let amount = '';
            const firstSend = transfer?.sends?.[0];
            if (firstSend) {
              const num = Number(firstSend.amount);
              let formatted: string;
              if (Number.isNaN(num)) {
                formatted = firstSend.amount;
              } else if (num < 0.01) {
                formatted = num.toPrecision(3);
              } else {
                formatted = num.toFixed(4).replace(/\.?0+$/, '');
              }
              amount = `${formatted} ${firstSend.symbol}`;
            } else if (decodedTx?.totalFeeFiatValue) {
              amount = `$${Number(decodedTx.totalFeeFiatValue).toFixed(2)}`;
            }

            // Get recipient
            const to = firstSend?.to || decodedTx?.to || '';

            return {
              id: decodedTx?.txid || tx.id || '',
              type: txType,
              to,
              amount,
              status: 'pending',
            };
          });
        }
      } catch (e) {
        console.warn('[TrayDataProvider] pending tx error:', e);
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      (globalThis as any).desktopApi?.sendTrayData(trayData);
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      (globalThis as any).desktopApi?.sendTrayData({
        wallet: { name: 'Wallet', emoji: '', avatarImg: '' },
        totalBalance: { amount: '0.00', currency: 'USD', change24h: 0 },
        watchlist: [],
        pendingTxs: [],
      });
    }
  }, []);

  // Handle tray navigation events — navigate within main window
  const handleTrayNavigation = useCallback(
    (_event: unknown, action: { type: string; [key: string]: unknown }) => {
      const nav = rootNavigationRef.current;
      if (!nav) return;

      if (action?.type === 'open-page') {
        // Simple navigation — just show main window and switch to the target tab
        if (action.route === '/main/tab-home') {
          nav.navigate(ERootRoutes.Main, {
            screen: ETabRoutes.Home,
          });
        }
        // For other routes like /transaction/{txId}, just show main window (done by caller)
        return;
      }

      if (action?.type === 'market-detail-v2') {
        // Perps token — switch to Perp tab and change active asset
        if (action.perpsCoin) {
          setTimeout(async () => {
            nav.navigate(ERootRoutes.Main, {
              screen: ETabRoutes.Perp,
            });
            try {
              await backgroundApiProxy.serviceHyperliquid.changeActiveAsset({
                coin: action.perpsCoin as string,
              });
            } catch (e) {
              console.warn('[TrayDataProvider] perps navigation error:', e);
            }
          }, 80);
          return;
        }

        // Spot token — navigate to MarketDetailV2
        if (action.tokenAddress && action.networkId) {
          const networkId = action.networkId as string;
          const shortCode = networkUtils.getNetworkShortCode({ networkId });
          nav.navigate(ERootRoutes.Main, {
            screen: ETabRoutes.Market,
            params: {
              screen: ETabMarketRoutes.MarketDetailV2,
              params: {
                tokenAddress: action.tokenAddress as string,
                network: shortCode || networkId,
                isNative: (action.isNative as boolean) || false,
              },
            },
          });
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!platformEnv.isDesktop) return;

    globalThis.addEventListener(
      'onekey-tray-data-request',
      handleTrayDataRequest,
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    (globalThis as any).desktopApi?.addIpcEventListener(
      TRAY_IPC.ACTION,
      handleTrayNavigation,
    );

    handleTrayDataRequestRef.current = handleTrayDataRequest;

    return () => {
      globalThis.removeEventListener(
        'onekey-tray-data-request',
        handleTrayDataRequest,
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      (globalThis as any).desktopApi?.removeIpcEventListener(
        TRAY_IPC.ACTION,
        handleTrayNavigation,
      );
    };
  }, [handleTrayDataRequest, handleTrayNavigation]);

  // Push data immediately when active account changes (wallet switch)
  useEffect(() => {
    if (!platformEnv.isDesktop) return;
    const timer = setTimeout(() => {
      handleTrayDataRequestRef.current?.();
    }, 300);
    return () => clearTimeout(timer);
  }, [activeAccountValue]);

  // Push lock state change immediately
  useEffect(() => {
    if (!platformEnv.isDesktop) return;
    handleTrayDataRequestRef.current?.();
  }, [appIsLocked]);

  // Refresh tray when tx status changes or history refreshes
  useEffect(() => {
    if (!platformEnv.isDesktop) return;

    const refresh = () => {
      setTimeout(() => {
        handleTrayDataRequestRef.current?.();
      }, 1000);
    };

    appEventBus.on(EAppEventBusNames.HistoryTxStatusChanged, refresh);
    appEventBus.on(EAppEventBusNames.RefreshHistoryList, refresh);
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, refresh);

    return () => {
      appEventBus.off(EAppEventBusNames.HistoryTxStatusChanged, refresh);
      appEventBus.off(EAppEventBusNames.RefreshHistoryList, refresh);
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, refresh);
    };
  }, []);
}
