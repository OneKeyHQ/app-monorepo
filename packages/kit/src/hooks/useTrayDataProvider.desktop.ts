import { useCallback, useEffect, useRef } from 'react';

import BigNumber from 'bignumber.js';

import { rootNavigationRef } from '@onekeyhq/components/src/layouts/Navigation/Navigator/NavigationContainer';
import {
  currencyPersistAtom,
  settingsPersistAtom,
  useActiveAccountValueAtom,
  useAppIsLockedAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes/tabMarket';
import {
  type ITrayData,
  type ITrayWatchlistItem,
  TRAY_IPC,
} from '@onekeyhq/shared/src/types/desktop/tray';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  composeTrayAccountChange24h,
  formatTrayPendingTxAmount,
} from '@onekeyhq/shared/src/utils/trayDataUtils';
import { calculateAccountTotalValue } from '@onekeyhq/shared/src/utils/tokenUtils';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { useActiveAccount } from '../states/jotai/contexts/accountSelector';

export function useTrayDataProvider() {
  const [activeAccountValue] = useActiveAccountValueAtom();
  const [appIsLocked] = useAppIsLockedAtom();
  const [{ enableMenuBarTray }] = useSettingsPersistAtom();
  const {
    activeAccount: { wallet, accountName },
  } = useActiveAccount({ num: 0 });
  // Guard every effect on this predicate so flipping the setting tears
  // down IPC/event subscriptions and re-subscribes without remounting.
  const isTrayActive = platformEnv.isDesktopMac && (enableMenuBarTray ?? true);
  const activeAccountValueRef = useRef(activeAccountValue);
  activeAccountValueRef.current = activeAccountValue;
  const appIsLockedRef = useRef(appIsLocked);
  appIsLockedRef.current = appIsLocked;
  const walletRef = useRef(wallet);
  walletRef.current = wallet;
  const accountNameRef = useRef<string>('');
  accountNameRef.current = accountName || '';
  const prevAccountIdRef = useRef<string | undefined>(undefined);
  const handleTrayDataRequestRef = useRef<(() => void) | undefined>(undefined);
  const pendingTxsClearedRef = useRef(false);
  // Renderer-side inflight guard — main-process `guardedRequest` only
  // covers poll-driven runs; renderer-triggered paths (account change,
  // appEventBus refresh) coalesce extra calls into a single trailing re-run.
  const inFlightRef = useRef(false);
  const trailingRefreshRef = useRef(false);

  const handleTrayDataRequestInner = useCallback(async () => {
    // Tray window can't reach backgroundApiProxy (DESKTOP_API_CALL is gated
    // to the main window), so we push locale inline with every payload.
    let locale = 'en-US';
    try {
      const l = await backgroundApiProxy.serviceSetting.getCurrentLocale();
      if (l) locale = l;
    } catch {
      // ignore
    }

    // Capture accountId up-front so every outbound payload (main/locked/error)
    // carries the identity the notification diff uses to reset its baseline.
    const activeAccountId = activeAccountValueRef.current?.accountId;

    const buildLockedPayload = (): ITrayData => ({
      isLocked: true,
      locale,
      accountId: activeAccountId,
      pendingTxsCleared: pendingTxsClearedRef.current,
      wallet: { name: '', emoji: '', avatarImg: '' },
      account: { name: accountNameRef.current },
      totalBalance: {
        amount: '0.00',
        currency: 'USD',
        symbol: '$',
      },
      watchlist: [],
      pendingTxs: [],
    });

    if (appIsLockedRef.current) {
      globalThis.desktopApi?.sendTrayData(buildLockedPayload());
      return;
    }

    // Resolve USD→target factor up-front so totalBalance and watchlist rows
    // format consistently; market API quotes USD and would otherwise be
    // displayed next to a localized total.
    let displayCurrency = 'usd';
    let displaySymbol = '$';
    let usdToTargetFactor = new BigNumber(1);
    try {
      const [{ currencyInfo }, { currencyMap }] = await Promise.all([
        settingsPersistAtom.get(),
        currencyPersistAtom.get(),
      ]);
      const targetCurrency = currencyInfo.id;
      const usdInfoRaw = currencyMap.usd;
      const targetInfoRaw = currencyMap[targetCurrency];
      if (usdInfoRaw && targetInfoRaw) {
        displayCurrency = targetCurrency;
        displaySymbol = targetInfoRaw.unit || targetCurrency.toUpperCase();
        usdToTargetFactor = new BigNumber(targetInfoRaw.value || '1').div(
          new BigNumber(usdInfoRaw.value || '1'),
        );
      }
    } catch {
      // currencyMap not populated yet — keep USD defaults.
    }

    try {
      const trayData: ITrayData = {
        locale,
        accountId: activeAccountId,
        pendingTxsCleared: pendingTxsClearedRef.current,
        wallet: { name: '', emoji: '', avatarImg: '' },
        account: { name: accountNameRef.current },
        totalBalance: {
          amount: '0.00',
          currency: displayCurrency,
          symbol: displaySymbol,
        },
        watchlist: [],
        pendingTxs: [],
      };

      const currentWallet = walletRef.current;
      if (currentWallet) {
        trayData.wallet.name = currentWallet.name || 'Wallet';
        if (currentWallet.avatar) {
          try {
            const avatarInfo = JSON.parse(currentWallet.avatar);
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
        if (!trayData.wallet.emoji && !trayData.wallet.avatarImg) {
          if (currentWallet.type === 'watching') {
            trayData.wallet.emoji = '👁';
          } else if (currentWallet.type === 'hw') {
            trayData.wallet.emoji = '🔑';
          } else {
            trayData.wallet.emoji = '💰';
          }
        }
      }

      // Tray is always cross-network (spec non-goal #1) — pass the
      // All-Networks id unconditionally, regardless of main window selection.
      const accountValue = activeAccountValueRef.current;
      if (accountValue && currentWallet) {
        try {
          // `value` is either a string (others account) or Record<key, string> (own).
          const val = accountValue.value;
          let tokensUsd = new BigNumber(0);
          if (typeof val === 'string') {
            tokensUsd = new BigNumber(val || '0');
          } else if (val && typeof val === 'object') {
            tokensUsd = Object.values(val).reduce(
              (sum, v) => sum.plus(new BigNumber(v || '0')),
              new BigNumber(0),
            );
          }
          const tokensInTarget = tokensUsd.times(usdToTargetFactor).toFixed();

          // DeFi via simpleDb.deFi cache only — no network call.
          let deFiNetWorth = '0';
          try {
            const deFiResp =
              await backgroundApiProxy.serviceDeFi.getAccountTotalDeFiNetWorth({
                accountId: accountValue.accountId,
                networkId: getNetworkIdsMap().onekeyall,
                targetCurrency: displayCurrency,
              });
            deFiNetWorth = deFiResp.netWorth;
          } catch (e) {
            defaultLogger.app.error.log(
              `[TrayDataProvider] defi fetch error: ${
                (e as Error)?.message || String(e)
              }`,
            );
          }

          const total =
            calculateAccountTotalValue({
              tokensValue: tokensInTarget,
              deFiNetWorth,
            }) ?? '0';

          trayData.totalBalance = {
            amount: new BigNumber(total).toFixed(2),
            currency: displayCurrency,
            symbol: displaySymbol,
            change24h: composeTrayAccountChange24h(),
          };
        } catch (e) {
          defaultLogger.app.error.log(
            `[TrayDataProvider] balance composition error: ${
              (e as Error)?.message || String(e)
            }`,
          );
        }
      }

      // BigNumber keeps sub-cent precision a raw JS Number would drop.
      const formatPriceInTarget = (usdPrice: number | string): string => {
        const converted = new BigNumber(usdPrice || 0).times(usdToTargetFactor);
        return `${displaySymbol}${converted.toFormat(2)}`;
      };
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
                response.list.forEach((coin: any) => {
                  if (!coin?.symbol) return;
                  // Match by networkId + address — API may reorder results.
                  const spotItem = spotItems.find(
                    (s: any) =>
                      s.chainId === coin.networkId &&
                      (s.contractAddress || '') === (coin.address || ''),
                  );
                  watchlistResults.push({
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    symbol: (coin.symbol || '').toUpperCase(),
                    name: coin.name || '',
                    icon: coin.logoUrl || '',
                    price: formatPriceInTarget(coin.price),
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
                      price: formatPriceInTarget(coin.markPrice),
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
        defaultLogger.app.error.log(
          `[TrayDataProvider] watchlist error: ${
            (e as Error)?.message || String(e)
          }`,
        );
      }

      // Track BOTH Pending and Failed so main-process diffAndNotify can tell
      // confirmed (Pending → gone) from failed (Pending → Failed → gone);
      // tracking only Pending would mis-fire "Confirmed" on failed txs.
      let pendingTxReadFailed = false;
      try {
        const rawData =
          await backgroundApiProxy.simpleDb.localHistory.getRawData();
        const allTrackedTxs: any[] = [];
        if (rawData?.pendingTxs) {
          for (const txs of Object.values(rawData.pendingTxs)) {
            if (Array.isArray(txs)) {
              for (const tx of txs) {
                const s = tx?.decodedTx?.status;
                if (
                  s === EDecodedTxStatus.Pending ||
                  s === EDecodedTxStatus.Failed
                ) {
                  allTrackedTxs.push(tx);
                }
              }
            }
          }
        }
        allTrackedTxs.sort(
          (a, b) =>
            (b.decodedTx?.createdAt || 0) - (a.decodedTx?.createdAt || 0),
        );
        const history = allTrackedTxs;
        if (history?.length) {
          trayData.pendingTxs = history.map((tx: any) => {
            const decodedTx = tx.decodedTx;
            const action = decodedTx?.actions?.[0];
            const transfer = action?.assetTransfer;

            let txType: 'send' | 'swap' | 'contract' | 'approve' = 'send';
            if (action?.type === 'INTERNAL_SWAP' || transfer?.isInternalSwap) {
              txType = 'swap';
            } else if (action?.type === 'TOKEN_APPROVE') {
              txType = 'approve';
            } else if (action?.type === 'ASSET_TRANSFER') {
              txType = 'send';
            }

            const firstSend = transfer?.sends?.[0];
            // NEVER fall back to totalFeeFiatValue here (OK-53607): gas fee is
            // not the tx amount and displaying it misleads users into thinking
            // they transferred cents when they actually approved or called a
            // contract.
            const amount = formatTrayPendingTxAmount({
              firstSend: firstSend
                ? { amount: firstSend.amount, symbol: firstSend.symbol }
                : undefined,
              txType,
            });

            const to = firstSend?.to || decodedTx?.to || '';

            const status: 'pending' | 'failed' =
              decodedTx?.status === EDecodedTxStatus.Failed
                ? 'failed'
                : 'pending';

            return {
              id: decodedTx?.txid || tx.id || '',
              type: txType,
              to,
              amount,
              status,
            };
          });
        }
      } catch (e) {
        defaultLogger.app.error.log(
          `[TrayDataProvider] pending tx error: ${
            (e as Error)?.message || String(e)
          }`,
        );
        pendingTxReadFailed = true;
      }

      // User may have locked mid-fetch — without this, gathered data would
      // leak to the tray window after lock, replacing the locked placeholder.
      if (appIsLockedRef.current) {
        globalThis.desktopApi?.sendTrayData(buildLockedPayload());
        return;
      }

      if (pendingTxReadFailed) {
        globalThis.desktopApi?.sendTrayData({
          ...trayData,
          isError: true,
        });
        pendingTxsClearedRef.current = false;
        return;
      }

      globalThis.desktopApi?.sendTrayData(trayData);
      pendingTxsClearedRef.current = false;
    } catch {
      // Prefer locked placeholder over error if user locked during the
      // failing request, so the panel doesn't flash last-known balances.
      if (appIsLockedRef.current) {
        globalThis.desktopApi?.sendTrayData(buildLockedPayload());
        return;
      }
      // `isError` tells trayIpc to skip the pending-tx diff so a transient
      // gather failure doesn't fire false "Confirmed" notifications.
      globalThis.desktopApi?.sendTrayData({
        isError: true,
        locale,
        accountId: activeAccountId,
        pendingTxsCleared: pendingTxsClearedRef.current,
        wallet: { name: 'Wallet', emoji: '', avatarImg: '' },
        account: { name: accountNameRef.current },
        totalBalance: {
          amount: '0.00',
          currency: 'USD',
          symbol: '$',
        },
        watchlist: [],
        pendingTxs: [],
      });
      pendingTxsClearedRef.current = false;
    }
  }, []);

  const handleTrayDataRequest = useCallback(async () => {
    if (inFlightRef.current) {
      trailingRefreshRef.current = true;
      return;
    }
    inFlightRef.current = true;
    try {
      await handleTrayDataRequestInner();
    } finally {
      inFlightRef.current = false;
      if (trailingRefreshRef.current) {
        trailingRefreshRef.current = false;
        // Microtask so the call stack unwinds and main-process
        // `guardedRequest` can release on TRAY_DATA_RESPONSE first.
        queueMicrotask(() => {
          void handleTrayDataRequestRef.current?.();
        });
      }
    }
  }, [handleTrayDataRequestInner]);

  // addIpcEventListener strips the IpcRendererEvent, so the action payload
  // is the first (and only) argument to this handler.
  const handleTrayNavigation = useCallback(
    (action: { type: string; [key: string]: unknown }) => {
      const nav = rootNavigationRef.current;
      if (!nav) return;

      if (action?.type === 'open-page') {
        if (action.route === '/main/tab-home') {
          nav.navigate(ERootRoutes.Main, {
            screen: ETabRoutes.Home,
          });
        }
        // Transaction-detail routes go through the EVENT_OPEN_URL
        // deep-link pipeline in trayIpc.ts and never reach here.
        return;
      }

      if (action?.type === 'view-all-transactions') {
        // No public route param to select the history sub-tab directly;
        // fall back to Home so the user at least lands on the right context.
        nav.navigate(ERootRoutes.Main, {
          screen: ETabRoutes.Home,
        });
        return;
      }

      if (action?.type === 'market-detail-v2') {
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
              defaultLogger.app.error.log(
                `[TrayDataProvider] perps navigation error: ${
                  (e as Error)?.message || String(e)
                }`,
              );
            }
          }, 80);
          return;
        }

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
    if (!isTrayActive) return;

    // `removeIpcEventListener` is a no-op in the main preload — the
    // unsubscribe function returned by addIpcEventListener is the only
    // way to actually clean up the listener.
    const requestHandler = () => {
      void handleTrayDataRequest();
    };
    const unsubscribeRequest = globalThis.desktopApi?.addIpcEventListener(
      TRAY_IPC.DATA_REQUEST,
      requestHandler,
    );
    const unsubscribeAction = globalThis.desktopApi?.addIpcEventListener(
      TRAY_IPC.ACTION,
      handleTrayNavigation as (...args: unknown[]) => void,
    );

    handleTrayDataRequestRef.current = handleTrayDataRequest;

    return () => {
      if (typeof unsubscribeRequest === 'function') {
        unsubscribeRequest();
      }
      if (typeof unsubscribeAction === 'function') {
        unsubscribeAction();
      }
    };
  }, [isTrayActive, handleTrayDataRequest, handleTrayNavigation]);

  // When the active account changes, two things happen in parallel:
  // 1. Emit an optimistic placeholder immediately so the tray window clears
  //    the previous account's balance/watchlist/pendingTxs within one frame —
  //    otherwise the user sees up to 2s of stale numbers (OK-53623).
  // 2. Fire the gather immediately (no 300ms wait). The inFlight guard in
  //    handleTrayDataRequest coalesces rapid cascades from ServiceAccountProfile
  //    refreshing per-network values; the trailing refresh re-runs once the
  //    burst settles so OK-53610 is also covered here.
  useEffect(() => {
    if (!isTrayActive) return;
    const currentAccountId = activeAccountValue?.accountId;
    if (currentAccountId !== prevAccountIdRef.current) {
      prevAccountIdRef.current = currentAccountId;
      globalThis.desktopApi?.sendTrayData({
        accountId: currentAccountId,
        pendingTxsCleared: false,
        wallet: {
          name: walletRef.current?.name || '',
          emoji: '',
          avatarImg: '',
        },
        account: { name: accountNameRef.current },
        totalBalance: {
          amount: '0.00',
          currency: 'usd',
          symbol: '$',
        },
        watchlist: [],
        pendingTxs: [],
      });
    }
    handleTrayDataRequestRef.current?.();
  }, [isTrayActive, activeAccountValue]);

  useEffect(() => {
    if (!isTrayActive) return;
    handleTrayDataRequestRef.current?.();
  }, [isTrayActive, appIsLocked]);

  // Main process inits tray by default — if the user previously disabled
  // it, tell main to destroy on startup.
  useEffect(() => {
    if (!platformEnv.isDesktopMac) return;
    void backgroundApiProxy.serviceSetting
      .getEnableMenuBarTray()
      .then((enabled) => {
        if (!enabled) {
          globalThis.desktopApi?.toggleTray(false);
        }
      });
  }, []);

  useEffect(() => {
    if (!isTrayActive) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        handleTrayDataRequestRef.current?.();
      }, 1500);
    };
    const handlePendingTxsCleared = () => {
      pendingTxsClearedRef.current = true;
      debouncedRefresh();
    };

    appEventBus.on(EAppEventBusNames.HistoryTxStatusChanged, debouncedRefresh);
    appEventBus.on(EAppEventBusNames.RefreshHistoryList, debouncedRefresh);
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, debouncedRefresh);
    appEventBus.on(
      EAppEventBusNames.ClearLocalHistoryPendingTxs,
      handlePendingTxsCleared,
    );

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      appEventBus.off(
        EAppEventBusNames.HistoryTxStatusChanged,
        debouncedRefresh,
      );
      appEventBus.off(EAppEventBusNames.RefreshHistoryList, debouncedRefresh);
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, debouncedRefresh);
      appEventBus.off(
        EAppEventBusNames.ClearLocalHistoryPendingTxs,
        handlePendingTxsCleared,
      );
    };
  }, [isTrayActive]);
}
