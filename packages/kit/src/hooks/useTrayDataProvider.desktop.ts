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
import { calculateAccountTotalValue } from '@onekeyhq/shared/src/utils/tokenUtils';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { useActiveAccount } from '../states/jotai/contexts/accountSelector';

export function useTrayDataProvider() {
  const [activeAccountValue] = useActiveAccountValueAtom();
  const [appIsLocked] = useAppIsLockedAtom();
  const [{ enableMenuBarTray }] = useSettingsPersistAtom();
  const {
    activeAccount: { wallet },
  } = useActiveAccount({ num: 0 });
  // The tray provider is mounted by Bootstrap only on macOS, but guard
  // every effect on the combined macOS + enableMenuBarTray predicate so
  // that flipping the setting tears down IPC/event subscriptions and
  // flipping it back on re-subscribes, without remounting the provider.
  const isTrayActive = platformEnv.isDesktopMac && (enableMenuBarTray ?? true);
  const activeAccountValueRef = useRef(activeAccountValue);
  activeAccountValueRef.current = activeAccountValue;
  const appIsLockedRef = useRef(appIsLocked);
  appIsLockedRef.current = appIsLocked;
  const walletRef = useRef(wallet);
  walletRef.current = wallet;
  const handleTrayDataRequestRef = useRef<(() => void) | undefined>(undefined);
  // Renderer-side inflight guard. Main-process `guardedRequest` already
  // serializes poll-driven runs, but renderer-only paths (active-account
  // change, appEventBus refresh) call `handleTrayDataRequest` directly
  // and would otherwise stack on top of an in-flight poll or each other.
  // We coalesce extra calls into a single trailing re-run so the tray
  // always ends up in sync with the latest state without stacking work.
  const inFlightRef = useRef(false);
  const trailingRefreshRef = useRef(false);

  const handleTrayDataRequestInner = useCallback(async () => {
    // Resolve locale once per request — the tray window can't reach
    // backgroundApiProxy (DESKTOP_API_CALL is gated to the main window),
    // so we push it inline with every ITrayData payload. Failure here
    // must not block the rest of the data — fall back to 'en-US'.
    let locale = 'en-US';
    try {
      const l = await backgroundApiProxy.serviceSetting.getCurrentLocale();
      if (l) locale = l;
    } catch {
      // ignore
    }

    // Capture accountId up-front so every outbound payload (main path,
    // locked/error branches) carries the same identity the notification
    // diff uses to decide whether to reset its pending-tx baseline.
    const activeAccountId = activeAccountValueRef.current?.accountId;

    const buildLockedPayload = (): ITrayData => ({
      isLocked: true,
      locale,
      accountId: activeAccountId,
      wallet: { name: '', emoji: '', avatarImg: '' },
      totalBalance: {
        amount: '0.00',
        currency: 'USD',
        symbol: '$',
        change24h: 0,
      },
      watchlist: [],
      pendingTxs: [],
    });

    // When locked, send empty data with isLocked flag to protect sensitive info
    if (appIsLockedRef.current) {
      globalThis.desktopApi?.sendTrayData(buildLockedPayload());
      return;
    }

    // Resolve the display currency + USD→target conversion factor up-front
    // so both totalBalance and watchlist rows format consistently. The
    // market API reports prices in USD; without conversion a CNY/EUR/JPY
    // user would see a localized total balance alongside USD-valued
    // watchlist rows labeled with a `$` sign.
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
        wallet: { name: '', emoji: '', avatarImg: '' },
        totalBalance: {
          amount: '0.00',
          currency: displayCurrency,
          symbol: displaySymbol,
          change24h: 0,
        },
        watchlist: [],
        pendingTxs: [],
      };

      // 1. Wallet name + emoji (from useActiveAccount reactive state)
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
        // Fallback emoji by wallet type (only if no avatar image)
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

      // 2. Balance (tokens + DeFi, in user's display currency)
      //
      // Tray semantic is "wallet at a glance" — always cross-network, NOT
      // following the main window's current network selection (spec non-goal #1).
      // We therefore pass the All-Networks id to getAccountTotalDeFiNetWorth
      // unconditionally.
      const accountValue = activeAccountValueRef.current;
      if (accountValue && currentWallet) {
        try {
          // activeAccountValueAtom is always USD; convert via the
          // pre-resolved factor. `value` is either a string (others
          // account) or Record<key, string> (own).
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

          // DeFi netWorth via service (reads simpleDb.deFi only; no network).
          // The real All-Networks id is 'onekeyall--0' — see
          // networkUtils.isAllNetwork / getNetworkIdsMap().onekeyall.
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
            change24h: 0,
          };
        } catch (e) {
          defaultLogger.app.error.log(
            `[TrayDataProvider] balance composition error: ${
              (e as Error)?.message || String(e)
            }`,
          );
          // Fall through: leave trayData.totalBalance at the initial default.
        }
      }

      // 3. Watchlist — both spot and perps
      //
      // Market API quotes USD; convert each row via `usdToTargetFactor`
      // so a CNY/EUR/JPY user sees consistent currency with totalBalance.
      // BigNumber precision matters for sub-cent long-tail tokens where
      // a raw JS `Number` would round away meaningful digits.
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
                response.list.forEach((coin: any) => {
                  if (!coin?.symbol) return;
                  // Match by networkId + address rather than array index,
                  // in case the API returns results in a different order.
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

      // 4. Pending transactions — read directly from simpleDb raw data.
      //
      // We include BOTH Pending and Failed txs in the tracked list (with real
      // status) so the main-process diffAndNotify can tell confirmed apart
      // from failed:
      //   - Pending → disappears from next snapshot ⇒ "Transaction Confirmed"
      //   - Pending → appears as Failed in next snapshot ⇒ "Transaction Failed"
      //     (then disappears the snapshot after, without re-firing)
      // If we only tracked Pending, a failed tx would look the same as a
      // confirmed one (just gone from the list) and fire the wrong notification.
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
        // Sort by most recent first
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

            // Determine tx type from action
            let txType: 'send' | 'swap' | 'contract' | 'approve' = 'send';
            if (action?.type === 'INTERNAL_SWAP' || transfer?.isInternalSwap) {
              txType = 'swap';
            } else if (action?.type === 'TOKEN_APPROVE') {
              txType = 'approve';
            } else if (action?.type === 'ASSET_TRANSFER') {
              txType = 'send';
            }

            // Get amount + symbol from first send transfer.
            // BigNumber — raw JS `Number` rounds away meaningful digits
            // for 18-decimal tokens (e.g. 0.000000123456 ETH would
            // collapse to 0 or lose precision).
            let amount = '';
            const firstSend = transfer?.sends?.[0];
            if (firstSend) {
              const bn = new BigNumber(firstSend.amount ?? '');
              let formatted: string;
              if (bn.isNaN()) {
                formatted = firstSend.amount;
              } else if (bn.abs().lt('0.01')) {
                formatted = bn.toPrecision(3);
              } else {
                formatted = bn.toFixed(4).replace(/\.?0+$/, '');
              }
              amount = `${formatted} ${firstSend.symbol}`;
            } else if (decodedTx?.totalFeeFiatValue) {
              amount = `${displaySymbol}${new BigNumber(
                decodedTx.totalFeeFiatValue,
              ).toFixed(2)}`;
            }

            // Get recipient
            const to = firstSend?.to || decodedTx?.to || '';

            // Map decoded status → tray status. Only Pending/Failed are
            // included in the tracked list above, so this is exhaustive.
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
      }

      // Re-check lock state: the user may have locked the app mid-fetch
      // while our awaits were in flight. Without this guard, the gathered
      // balance/watchlist/pending-tx data would leak to the tray window
      // after lock, replacing the "App is Locked" placeholder.
      if (appIsLockedRef.current) {
        globalThis.desktopApi?.sendTrayData(buildLockedPayload());
        return;
      }

      globalThis.desktopApi?.sendTrayData(trayData);
    } catch {
      // If the user locked during the failing request, prefer the locked
      // placeholder over the error placeholder so the panel doesn't briefly
      // flash last-known balances before landing on "App is Locked".
      if (appIsLockedRef.current) {
        globalThis.desktopApi?.sendTrayData(buildLockedPayload());
        return;
      }
      // Send error fallback — the `isError` flag tells trayIpc to skip the
      // pending-tx diff, so a transient data-gathering failure doesn't
      // trigger false "Transaction Confirmed" notifications for tracked txs.
      globalThis.desktopApi?.sendTrayData({
        isError: true,
        locale,
        accountId: activeAccountId,
        wallet: { name: 'Wallet', emoji: '', avatarImg: '' },
        totalBalance: {
          amount: '0.00',
          currency: 'USD',
          symbol: '$',
          change24h: 0,
        },
        watchlist: [],
        pendingTxs: [],
      });
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
        // Schedule the coalesced trailing run on the microtask queue so
        // we don't blow the call stack, and so main-process paths that
        // release `guardedRequest` on TRAY_DATA_RESPONSE can settle.
        queueMicrotask(() => {
          void handleTrayDataRequestRef.current?.();
        });
      }
    }
  }, [handleTrayDataRequestInner]);

  // Handle tray navigation events — navigate within main window.
  // addIpcEventListener strips the IpcRendererEvent, so the action payload
  // is the first (and only) argument to this handler.
  const handleTrayNavigation = useCallback(
    (action: { type: string; [key: string]: unknown }) => {
      const nav = rootNavigationRef.current;
      if (!nav) return;

      if (action?.type === 'open-page') {
        // Simple navigation — just show main window and switch to the target tab.
        if (action.route === '/main/tab-home') {
          nav.navigate(ERootRoutes.Main, {
            screen: ETabRoutes.Home,
          });
        }
        // Transaction-detail routes (`/transaction/:txid`) are redirected
        // to the EVENT_OPEN_URL deep-link pipeline in `trayIpc.ts` and
        // therefore never reach this handler. Other routes fall through
        // intentionally — main window is already shown by the caller.
        return;
      }

      if (action?.type === 'view-all-transactions') {
        // Fallback to Home tab. The Home tab hosts the history sub-tab
        // but there's no public route param to select it from here, so
        // the user lands on Home and the tray has at least surfaced the
        // main window with the account context.
        nav.navigate(ERootRoutes.Main, {
          screen: ETabRoutes.Home,
        });
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
              defaultLogger.app.error.log(
                `[TrayDataProvider] perps navigation error: ${
                  (e as Error)?.message || String(e)
                }`,
              );
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
    if (!isTrayActive) return;

    // Subscribe to TRAY_DATA_REQUEST via IPC — the old pattern that dispatched
    // a DOM event from preload no longer works under contextIsolation:true
    // because the preload's globalThis is isolated from the renderer's window.
    //
    // `removeIpcEventListener` is a documented no-op in the main preload;
    // we must use the unsubscribe function returned by addIpcEventListener
    // to actually clean up the listener.
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

  // Push data immediately when active account changes (wallet switch)
  useEffect(() => {
    if (!isTrayActive) return;
    const timer = setTimeout(() => {
      handleTrayDataRequestRef.current?.();
    }, 300);
    return () => clearTimeout(timer);
  }, [isTrayActive, activeAccountValue]);

  // Push lock state change immediately
  useEffect(() => {
    if (!isTrayActive) return;
    handleTrayDataRequestRef.current?.();
  }, [isTrayActive, appIsLocked]);

  // Sync tray enabled state on startup — main process inits tray by default,
  // so if the user previously disabled it, tell main to destroy it.
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

  // Refresh tray when tx status changes or history refreshes (debounced)
  useEffect(() => {
    if (!isTrayActive) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        handleTrayDataRequestRef.current?.();
      }, 1500);
    };

    appEventBus.on(EAppEventBusNames.HistoryTxStatusChanged, debouncedRefresh);
    appEventBus.on(EAppEventBusNames.RefreshHistoryList, debouncedRefresh);
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, debouncedRefresh);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      appEventBus.off(
        EAppEventBusNames.HistoryTxStatusChanged,
        debouncedRefresh,
      );
      appEventBus.off(EAppEventBusNames.RefreshHistoryList, debouncedRefresh);
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, debouncedRefresh);
    };
  }, [isTrayActive]);
}
