import { useCallback, useEffect, useRef } from 'react';

import BigNumber from 'bignumber.js';

import { rootNavigationRef } from '@onekeyhq/components/src/layouts/Navigation/Navigator/NavigationContainer';
import {
  useActiveAccountValueAtom,
  useAppIsLockedAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
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
import networkUtils, {
  isEnabledNetworksInAllNetworks,
} from '@onekeyhq/shared/src/utils/networkUtils';
import {
  getHyperliquidTokenImageUrl,
  getTokenSubtitle,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import { calculateAccountTotalValue } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  composeTrayAccountChange24h,
  formatTrayPendingTxAmount,
} from '@onekeyhq/shared/src/utils/trayDataUtils';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { useActiveAccount } from '../states/jotai/contexts/accountSelector';

import {
  TRAY_DATA_REFRESH_EVENT_NAMES,
  getTrayTokenValueInTargetCurrency,
} from './trayDataProviderUtils';

const USD_CURRENCY_ID = 'usd';
const USD_CURRENCY_SYMBOL = '$';

function getNetworkLogoUri(networkId?: string): string {
  if (!networkId) return '';
  const network = getPresetNetworks().find((n) => n.id === networkId);
  return network?.logoURI || '';
}

type ITrayEnabledNetworkScope = {
  enabledNetworkIds: string[];
  enabledNetworksCompatibleWithWalletId: Array<{ id: string }>;
  networkInfoMap: Record<
    string,
    {
      deriveType: string;
      mergeDeriveAssetsEnabled: boolean;
    }
  >;
};

async function getTrayEnabledNetworkScope({
  walletId,
  accountId,
}: {
  walletId: string;
  accountId?: string;
}): Promise<ITrayEnabledNetworkScope> {
  const [{ enabledNetworks, disabledNetworks }, { networks }] =
    await Promise.all([
      backgroundApiProxy.serviceAllNetwork.getAllNetworksState(),
      backgroundApiProxy.serviceNetwork.getAllNetworks({
        excludeTestNetwork: true,
        excludeAllNetworkItem: true,
      }),
    ]);

  const enabledNetworkIds = networks
    .filter((network) =>
      isEnabledNetworksInAllNetworks({
        networkId: network.id,
        enabledNetworks,
        disabledNetworks,
        isTestnet: !!network.isTestnet,
      }),
    )
    .map((network) => network.id);

  if (enabledNetworkIds.length === 0) {
    return {
      enabledNetworkIds: [],
      enabledNetworksCompatibleWithWalletId: [],
      networkInfoMap: {},
    };
  }

  const compatibleNetworks =
    await backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
      {
        accountId,
        walletId,
        networkIds: enabledNetworkIds,
      },
    );

  const enabledNetworksCompatibleWithWalletId =
    compatibleNetworks.mainnetItems ?? [];

  const networkInfoEntries = await Promise.all(
    enabledNetworksCompatibleWithWalletId.map(async (network) => {
      const [deriveType, vaultSettings] = await Promise.all([
        backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId: network.id,
        }),
        backgroundApiProxy.serviceNetwork.getVaultSettings({
          networkId: network.id,
        }),
      ]);
      return [
        network.id,
        {
          deriveType,
          mergeDeriveAssetsEnabled: !!vaultSettings.mergeDeriveAssetsEnabled,
        },
      ] as const;
    }),
  );

  return {
    enabledNetworkIds: enabledNetworksCompatibleWithWalletId.map(
      (network) => network.id,
    ),
    enabledNetworksCompatibleWithWalletId,
    networkInfoMap: Object.fromEntries(networkInfoEntries),
  };
}

export function useTrayDataProvider() {
  const [activeAccountValue] = useActiveAccountValueAtom();
  const [appIsLocked] = useAppIsLockedAtom();
  const [{ enableMenuBarTray }] = useSettingsPersistAtom();
  const {
    activeAccount: { wallet, accountName, account },
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
  const accountRef = useRef(account);
  accountRef.current = account;
  const accountNameRef = useRef<string>('');
  accountNameRef.current = accountName || '';
  // Seed with the current accountId so the first mount isn't mis-detected as
  // an account switch, which would clobber cache primed by main-process
  // guardedRequest() with an optimistic $0.00 placeholder.
  const prevAccountIdRef = useRef<string | undefined>(
    activeAccountValue?.accountId,
  );
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

    const displayCurrency = USD_CURRENCY_ID;
    const displaySymbol = USD_CURRENCY_SYMBOL;
    const usdToTargetFactor = new BigNumber(1);

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
          let enabledNetworkScope: ITrayEnabledNetworkScope | undefined;
          if (val && typeof val === 'object' && currentWallet.id) {
            try {
              enabledNetworkScope = await getTrayEnabledNetworkScope({
                walletId: currentWallet.id,
                accountId: accountRef.current?.id,
              });
            } catch (e) {
              defaultLogger.app.error.log(
                `[TrayDataProvider] enabled networks fetch error: ${
                  (e as Error)?.message || String(e)
                }`,
              );
            }
          }
          const tokensInTarget = getTrayTokenValueInTargetCurrency({
            tokensValue: val,
            usdToTargetFactor,
            walletId: currentWallet.id,
            enabledNetworksCompatibleWithWalletId:
              enabledNetworkScope?.enabledNetworksCompatibleWithWalletId,
            networkInfoMap: enabledNetworkScope?.networkInfoMap,
          });

          // DeFi via simpleDb.deFi cache only — no network call.
          let deFiNetWorth = '0';
          try {
            const deFiResp =
              await backgroundApiProxy.serviceDeFi.getAccountTotalDeFiNetWorth({
                accountId: accountValue.accountId,
                networkId: getNetworkIdsMap().onekeyall,
                targetCurrency: displayCurrency,
                enabledNetworkIds: enabledNetworkScope?.enabledNetworkIds,
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
                  const networkId = coin.networkId || spotItem?.chainId || '';
                  watchlistResults.push({
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    symbol: (coin.symbol || '').toUpperCase(),
                    name: coin.name || '',
                    icon: coin.logoUrl || coin.logoUrls?.[0] || '',
                    iconUrls: coin.logoUrls,
                    networkIcon: getNetworkLogoUri(networkId),
                    price: formatPriceInTarget(coin.price),
                    change24h: Number(coin.priceChange24hPercent || 0),
                    type: 'spot',
                    tokenAddress:
                      coin.address || spotItem?.contractAddress || '',
                    networkId,
                    isNative: spotItem?.isNative ?? false,
                    communityRecognized: coin.communityRecognized,
                    stock: coin.stock,
                  });
                });
              }
            } catch {
              // spot fetch failed
            }
          }

          if (perpsItems.length > 0) {
            try {
              const [perpsDataResult, tokenSearchAliasesResult] =
                await Promise.allSettled([
                  backgroundApiProxy.serviceMarketV2.fetchMarketPerpsTokenList({
                    category: 'all',
                  }),
                  backgroundApiProxy.serviceHyperliquid.getTokenSearchAliases(),
                ]);
              const perpsData =
                perpsDataResult.status === 'fulfilled'
                  ? perpsDataResult.value
                  : undefined;
              const tokenSearchAliases =
                tokenSearchAliasesResult.status === 'fulfilled'
                  ? tokenSearchAliasesResult.value
                  : undefined;
              if (perpsData?.tokens?.length) {
                for (const item of perpsItems) {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                  const coin = perpsData.tokens.find(
                    (t: any) =>
                      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                      t.name?.toUpperCase() === item.perpsCoin?.toUpperCase(),
                  );
                  if (coin) {
                    const parsedCoin = parseDexCoin(
                      coin.name || item.perpsCoin || '',
                    );
                    const parsedDisplay = parseDexCoin(
                      coin.displayName ||
                        parsedCoin.displayName ||
                        item.perpsCoin ||
                        '',
                    );
                    const displayName =
                      parsedDisplay.displayName ||
                      parsedCoin.displayName ||
                      item.perpsCoin ||
                      '';
                    watchlistResults.push({
                      symbol: displayName,
                      name: '',
                      icon:
                        coin.tokenImageUrl ||
                        getHyperliquidTokenImageUrl(
                          parsedCoin.displayName || displayName,
                        ),
                      price: formatPriceInTarget(coin.markPrice),
                      change24h: coin.change24hPercent || 0,
                      type: 'perps',
                      perpsCoin: item.perpsCoin,
                      maxLeverage: coin.maxLeverage,
                      subtitle: getTokenSubtitle(
                        coin.name || item.perpsCoin || '',
                        tokenSearchAliases,
                      ),
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

  // Account switch: push an optimistic placeholder + gather immediately so the
  // panel clears stale numbers within one frame (OK-53623). Non-switch identity
  // changes (per-network profile refresh) keep the 300ms debounce so the
  // cascade in OK-53610 is absorbed.
  useEffect(() => {
    if (!isTrayActive) return;
    const currentAccountId = activeAccountValue?.accountId;
    const accountJustChanged = currentAccountId !== prevAccountIdRef.current;
    if (accountJustChanged) {
      prevAccountIdRef.current = currentAccountId;
      globalThis.desktopApi?.sendTrayData({
        accountId: currentAccountId,
        pendingTxsCleared: false,
        // Fall back to 'Wallet' — an empty name falls through to the
        // `noWallet` empty-state branch in TrayPanel, which would replace
        // the optimistic zeros with a full-panel "no wallet" screen.
        wallet: {
          name: walletRef.current?.name || 'Wallet',
          emoji: '',
          avatarImg: '',
        },
        account: { name: accountNameRef.current },
        totalBalance: {
          amount: '0.00',
          currency: 'USD',
          symbol: '$',
        },
        watchlist: [],
        pendingTxs: [],
      });
      handleTrayDataRequestRef.current?.();
      return;
    }
    const timer = setTimeout(() => {
      handleTrayDataRequestRef.current?.();
    }, 300);
    return () => clearTimeout(timer);
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

    TRAY_DATA_REFRESH_EVENT_NAMES.forEach((eventName) => {
      appEventBus.on(eventName, debouncedRefresh);
    });
    appEventBus.on(
      EAppEventBusNames.ClearLocalHistoryPendingTxs,
      handlePendingTxsCleared,
    );

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      TRAY_DATA_REFRESH_EVENT_NAMES.forEach((eventName) => {
        appEventBus.off(eventName, debouncedRefresh);
      });
      appEventBus.off(
        EAppEventBusNames.ClearLocalHistoryPendingTxs,
        handlePendingTxsCleared,
      );
    };
  }, [isTrayActive]);
}
