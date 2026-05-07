import { useCallback, useEffect, useRef } from 'react';

import BigNumber from 'bignumber.js';

import {
  resetAboveMainRoute,
  rootNavigationRef,
  switchTabAsync,
} from '@onekeyhq/components/src/layouts/Navigation/Navigator/NavigationContainer';
import type {
  IDBAccount,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  useActiveAccountValueAtom,
  useAppIsLockedAtom,
  useCurrencyPersistAtom,
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
import {
  EModalAssetDetailRoutes,
  EModalRoutes,
  ERootRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes/tabMarket';
import {
  type IPendingTx,
  type ITrayAccountAvatarInfo,
  type ITrayAction,
  type ITrayData,
  type ITrayWalletAvatarInfo,
  type ITrayWatchlistItem,
  TRAY_IPC,
} from '@onekeyhq/shared/src/types/desktop/tray';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
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
  getTrayPendingTxAmountInfo,
  getTrayPendingTxType,
} from '@onekeyhq/shared/src/utils/trayDataUtils';
import { getDisplayedActions } from '@onekeyhq/shared/src/utils/txActionUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';
import { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { useActiveAccount } from '../states/jotai/contexts/accountSelector';

import {
  type ITrayActiveAccountScope,
  TRAY_DATA_REFRESH_EVENT_NAMES,
  buildTrayWatchlistInSourceOrder,
  collectTrayTrackedTxs,
  formatTrayUsdPrice,
  getTrayCurrencyDisplayInfo,
  getTrayMarketNavigationTarget,
  getTrayTokenValueInTargetCurrency,
  getTrayWatchlistNativeInfo,
  recoverFailedTrackedTxs,
} from './trayDataProviderUtils';

const TRAY_ROUTE_HOME = '/main/tab-home';
const TRAY_ROUTE_MARKET = '/main/tab-market';
// Fires while pending txs exist even when panel is closed and home is unfocused.
const TRAY_PENDING_TX_RECHECK_INTERVAL_MS = 12_000;

async function refreshTrayPendingTxStatuses(
  txs: IAccountHistoryTx[],
): Promise<void> {
  const requestKeys = new Set<string>();
  const requests: Array<{ accountId: string; networkId: string }> = [];

  for (const tx of txs) {
    if (tx.decodedTx?.status === EDecodedTxStatus.Pending) {
      const { accountId, networkId } = tx.decodedTx;
      if (accountId && networkId) {
        const key = `${accountId}__${networkId}`;
        if (!requestKeys.has(key)) {
          requestKeys.add(key);
          requests.push({ accountId, networkId });
        }
      }
    }
  }

  if (!requests.length) return;

  const results = await Promise.allSettled(
    requests.map(({ accountId, networkId }) =>
      backgroundApiProxy.serviceHistory.fetchAccountHistory({
        accountId,
        networkId,
        isManualRefresh: true,
        excludeTestNetwork: true,
        limit: 10,
      }),
    ),
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const request = requests[index];
      defaultLogger.app.error.log(
        `[TrayDataProvider] pending tx refresh error: ${
          (result.reason as Error)?.message || String(result.reason)
        } (${request.accountId}, ${request.networkId})`,
      );
    }
  });
}

async function findTrayHistoryTxByAction(
  action: ITrayAction,
): Promise<IAccountHistoryTx | undefined> {
  if (action.accountId && action.networkId && action.historyId) {
    const localTx =
      await backgroundApiProxy.serviceHistory.getLocalHistoryTxById({
        accountId: action.accountId,
        networkId: action.networkId,
        historyId: action.historyId,
      });
    if (localTx) return localTx;
  }

  const txid = action.txid || action.historyId;
  if (!txid) return undefined;

  const rawData = await backgroundApiProxy.simpleDb.localHistory.getRawData();
  const txGroups: IAccountHistoryTx[][] = [
    ...Object.values(rawData?.pendingTxs ?? {}),
    ...Object.values(rawData?.confirmedTxs ?? {}),
  ];
  for (const group of txGroups) {
    if (Array.isArray(group)) {
      const found = group.find(
        (tx) => tx.id === txid || tx.decodedTx?.txid === txid,
      );
      if (found) return found;
    }
  }

  return undefined;
}

function getNetworkLogoUri(networkId?: string): string {
  if (!networkId) return '';
  const network = getPresetNetworks().find((n) => n.id === networkId);
  return network?.logoURI || '';
}

function getTrayWalletAvatarInfo(
  wallet: IDBWallet | undefined,
): ITrayWalletAvatarInfo | undefined {
  if (wallet?.avatarInfo) {
    return wallet.avatarInfo;
  }

  if (!wallet?.avatar) return undefined;
  try {
    return JSON.parse(wallet.avatar) as ITrayWalletAvatarInfo;
  } catch {
    return undefined;
  }
}

function buildTrayWalletInfo(
  wallet: IDBWallet | undefined,
  fallbackName = '',
): ITrayData['wallet'] {
  const walletInfo: ITrayData['wallet'] = {
    id: wallet?.id,
    name: wallet?.name || fallbackName,
    emoji: '',
    avatarImg: '',
    type: wallet?.type,
    passphraseState: wallet?.passphraseState,
    firmwareTypeAtCreated: wallet?.firmwareTypeAtCreated,
  };

  const avatarInfo = getTrayWalletAvatarInfo(wallet);
  if (avatarInfo) {
    walletInfo.avatarInfo = avatarInfo;
    if (avatarInfo.emoji && avatarInfo.emoji !== 'img') {
      walletInfo.emoji = avatarInfo.emoji;
    }
    if (avatarInfo.img) {
      walletInfo.avatarImg = avatarInfo.img;
    }
  }

  if (wallet && !walletInfo.emoji && !walletInfo.avatarImg) {
    if (wallet.type === 'watching') {
      walletInfo.emoji = '👁';
    } else if (wallet.type === 'hw') {
      walletInfo.emoji = '🔑';
    } else {
      walletInfo.emoji = '💰';
    }
  }

  return walletInfo;
}

function buildTrayAccountInfo({
  accountName,
  account,
  indexedAccount,
  dbAccount,
}: {
  accountName: string;
  account: { id?: string; address?: string } | undefined;
  indexedAccount: IDBIndexedAccount | undefined;
  dbAccount: IDBAccount | undefined;
}): ITrayData['account'] {
  const avatar: ITrayAccountAvatarInfo = {};
  if (indexedAccount) {
    avatar.indexedAccount = {
      id: indexedAccount.id,
      idHash: indexedAccount.idHash,
    };
  }
  if (account) {
    avatar.account = {
      id: account.id,
      address: account.address,
    };
  }
  if (dbAccount) {
    const dbAccountWithConnection = dbAccount as IDBAccount & {
      connectionInfo?: unknown;
    };
    avatar.dbAccount = {
      id: dbAccountWithConnection.id,
      address: dbAccountWithConnection.address,
      connectionInfo: dbAccountWithConnection.connectionInfo,
    };
  }
  if (!avatar.indexedAccount && !avatar.account && !avatar.dbAccount) {
    const address = account?.address || dbAccount?.address;
    if (address) {
      avatar.address = address;
    }
  }

  return Object.keys(avatar).length
    ? { name: accountName, avatar }
    : { name: accountName };
}

function getIndexedAccountIdFromActiveAccountId({
  activeAccountId,
  walletId,
}: {
  activeAccountId: string | undefined;
  walletId: string | undefined;
}) {
  if (!activeAccountId || !walletId) return undefined;
  const parsed = accountUtils.parseIndexedAccountId({
    indexedAccountId: activeAccountId,
  });
  if (parsed.walletId === walletId && Number.isInteger(parsed.index)) {
    return activeAccountId;
  }
  return undefined;
}

async function getTrayActiveAccountScope({
  wallet,
  activeAccountId,
  account,
  indexedAccount,
  dbAccount,
}: {
  wallet: IDBWallet | undefined;
  activeAccountId: string | undefined;
  account: { id?: string } | undefined;
  indexedAccount: IDBIndexedAccount | undefined;
  dbAccount: IDBAccount | undefined;
}): Promise<ITrayActiveAccountScope> {
  const accountIds = new Set<string>();
  const addAccountId = (accountId?: string) => {
    if (accountId) accountIds.add(accountId);
  };

  const walletId = wallet?.id;
  const shouldUseIndexedAccountScope =
    accountUtils.isHdWallet({ walletId }) ||
    accountUtils.isHwWallet({ walletId });

  if (shouldUseIndexedAccountScope) {
    const indexedAccountId =
      indexedAccount?.id ||
      dbAccount?.indexedAccountId ||
      getIndexedAccountIdFromActiveAccountId({ activeAccountId, walletId });

    if (indexedAccountId) {
      try {
        const { accounts } =
          await backgroundApiProxy.serviceAccount.getAccountsInSameIndexedAccountId(
            { indexedAccountId },
          );
        accounts.forEach((item) => addAccountId(item.id));
      } catch (e) {
        defaultLogger.app.error.log(
          `[TrayDataProvider] active account scope error: ${
            (e as Error)?.message || String(e)
          }`,
        );
      }
    }

    addAccountId(account?.id);
    addAccountId(dbAccount?.id);
  } else {
    addAccountId(account?.id);
    addAccountId(dbAccount?.id);
    addAccountId(activeAccountId);
  }

  return { accountIds: Array.from(accountIds) };
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
  const [
    {
      enableMenuBarTray,
      currencyInfo,
      locale: settingsLocale,
      lastLocale: settingsLastLocale,
    },
  ] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const {
    activeAccount: { wallet, accountName, account, indexedAccount, dbAccount },
  } = useActiveAccount({ num: 0 });
  const isTrayActive = platformEnv.isDesktopMac && (enableMenuBarTray ?? true);
  const activeAccountValueRef = useRef(activeAccountValue);
  activeAccountValueRef.current = activeAccountValue;
  const appIsLockedRef = useRef(appIsLocked);
  appIsLockedRef.current = appIsLocked;
  const currencyInfoRef = useRef(currencyInfo);
  currencyInfoRef.current = currencyInfo;
  const currencyMapRef = useRef(currencyMap);
  currencyMapRef.current = currencyMap;
  const walletRef = useRef(wallet);
  walletRef.current = wallet;
  const accountRef = useRef(account);
  accountRef.current = account;
  const indexedAccountRef = useRef(indexedAccount);
  indexedAccountRef.current = indexedAccount;
  const dbAccountRef = useRef(dbAccount);
  dbAccountRef.current = dbAccount;
  const accountNameRef = useRef<string>('');
  accountNameRef.current = accountName || '';
  // Seed with current accountId so first mount isn't mis-detected as a switch.
  const prevAccountIdRef = useRef<string | undefined>(
    activeAccountValue?.accountId,
  );
  const handleTrayDataRequestRef = useRef<(() => void) | undefined>(undefined);
  const pendingTxsClearedRef = useRef(false);
  // Renderer-side inflight guard for non-poll paths (account change, refresh).
  const inFlightRef = useRef(false);
  const trailingRefreshRef = useRef(false);
  const hasPendingTxRef = useRef(false);
  // Cached resolved watchlist for the account-switch optimistic placeholder (OK-54088).
  const lastWatchlistRef = useRef<ITrayWatchlistItem[]>([]);
  const pendingRecheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isTrayActiveRef = useRef(isTrayActive);
  isTrayActiveRef.current = isTrayActive;

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

    // Capture accountId up-front so every outbound payload carries the same identity.
    const activeAccountId = activeAccountValueRef.current?.accountId;
    let trayCurrencyMap = currencyMapRef.current;
    const selectedCurrencyId = currencyInfoRef.current?.id || 'usd';
    if (
      selectedCurrencyId !== 'usd' &&
      !trayCurrencyMap?.[selectedCurrencyId]
    ) {
      try {
        trayCurrencyMap =
          await backgroundApiProxy.serviceSetting.getCurrencyMap();
      } catch (e) {
        defaultLogger.app.error.log(
          `[TrayDataProvider] currency map fetch error: ${
            (e as Error)?.message || String(e)
          }`,
        );
      }
    }
    const { displayCurrency, displaySymbol, usdToTargetFactor } =
      getTrayCurrencyDisplayInfo({
        currencyInfo: currencyInfoRef.current,
        currencyMap: trayCurrencyMap,
      });

    const buildLockedPayload = (): ITrayData => ({
      isLocked: true,
      locale,
      accountId: activeAccountId,
      pendingTxsCleared: pendingTxsClearedRef.current,
      wallet: buildTrayWalletInfo(undefined),
      account: buildTrayAccountInfo({
        accountName: accountNameRef.current,
        account: accountRef.current,
        indexedAccount: indexedAccountRef.current,
        dbAccount: dbAccountRef.current,
      }),
      totalBalance: {
        amount: '0.00',
        currency: displayCurrency,
        symbol: displaySymbol,
      },
      watchlist: [],
      pendingTxs: [],
    });

    if (appIsLockedRef.current) {
      globalThis.desktopApi?.sendTrayData(buildLockedPayload());
      return;
    }

    try {
      const trayData: ITrayData = {
        locale,
        accountId: activeAccountId,
        pendingTxsCleared: pendingTxsClearedRef.current,
        wallet: buildTrayWalletInfo(undefined),
        account: buildTrayAccountInfo({
          accountName: accountNameRef.current,
          account: accountRef.current,
          indexedAccount: indexedAccountRef.current,
          dbAccount: dbAccountRef.current,
        }),
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
        trayData.wallet = buildTrayWalletInfo(currentWallet, 'Wallet');
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

          const watchlistResults: Array<{
            sourceItem: {
              chainId?: string;
              contractAddress?: string;
              isNative?: boolean;
              perpsCoin?: string;
            };
            item: ITrayWatchlistItem;
          }> = [];

          if (spotItems.length > 0) {
            try {
              const tokenAddressList = spotItems.map((item: any) => ({
                chainId: item.chainId,
                contractAddress: item.contractAddress || '',
                isNative: getTrayWatchlistNativeInfo({
                  isNative: item.isNative,
                  contractAddress: item.contractAddress,
                }).isNative,
              }));
              const response =
                await backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch(
                  { tokenAddressList },
                );
              if (response?.list?.length) {
                // Align by spotItems index — API row is display-only; networkId
                // shortcodes and address casing make field matching fragile.
                spotItems.forEach((spotItem: any, index: number) => {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
                  const coin = response.list[index] as any;
                  if (!coin?.symbol) return;
                  const { isNative: spotIsNative, tokenAddress } =
                    getTrayWatchlistNativeInfo({
                      isNative: spotItem.isNative as boolean | undefined,
                      contractAddress: spotItem.contractAddress as
                        | string
                        | undefined,
                    });
                  watchlistResults.push({
                    sourceItem: spotItem,
                    item: {
                      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                      symbol: (coin.symbol || '').toUpperCase(),
                      name: coin.name || '',
                      icon: coin.logoUrl || coin.logoUrls?.[0] || '',
                      iconUrls: coin.logoUrls,
                      networkIcon: getNetworkLogoUri(spotItem.chainId),
                      price: formatTrayUsdPrice(coin.price),
                      change24h: Number(coin.priceChange24hPercent || 0),
                      type: 'spot',
                      tokenAddress,
                      networkId: spotItem.chainId,
                      isNative: spotIsNative,
                      communityRecognized: coin.communityRecognized,
                      stock: coin.stock,
                    },
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
                      sourceItem: item,
                      item: {
                        symbol: displayName,
                        name: '',
                        icon:
                          coin.tokenImageUrl ||
                          getHyperliquidTokenImageUrl(
                            parsedCoin.displayName || displayName,
                          ),
                        price: formatTrayUsdPrice(coin.markPrice),
                        change24h: coin.change24hPercent || 0,
                        type: 'perps',
                        perpsCoin: item.perpsCoin,
                        maxLeverage: coin.maxLeverage,
                        subtitle: getTokenSubtitle(
                          coin.name || item.perpsCoin || '',
                          tokenSearchAliases,
                        ),
                      },
                    });
                  }
                }
              }
            } catch {
              // perps fetch failed
            }
          }

          trayData.watchlist = buildTrayWatchlistInSourceOrder({
            sourceItems: watchListData.data,
            resolvedItems: watchlistResults,
          });
        }
        // Only update on a non-throwing fetch — keep prior value on transient errors.
        lastWatchlistRef.current = trayData.watchlist;
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
        const activeAccountScope = await getTrayActiveAccountScope({
          wallet: currentWallet,
          activeAccountId,
          account: accountRef.current,
          indexedAccount: indexedAccountRef.current,
          dbAccount: dbAccountRef.current,
        });
        let rawData =
          await backgroundApiProxy.simpleDb.localHistory.getRawData();
        let allTrackedTxs = collectTrayTrackedTxs(rawData, activeAccountScope);
        const trackedPendingIds = new Set(
          allTrackedTxs
            .filter((tx) => tx.decodedTx?.status === EDecodedTxStatus.Pending)
            .map((tx) => tx.id),
        );
        if (trackedPendingIds.size > 0) {
          await refreshTrayPendingTxStatuses(allTrackedTxs);
          rawData = await backgroundApiProxy.simpleDb.localHistory.getRawData();
          allTrackedTxs = collectTrayTrackedTxs(rawData, activeAccountScope);
          // Refresh moves failed txs out of the pendingTxs bucket
          // (SimpleDbEntityLocalHistory's save filters that bucket to
          // Pending-only), so re-attach them from confirmedTxs by id /
          // originalId — otherwise diffAndNotify mis-fires "Confirmed".
          const recovered = recoverFailedTrackedTxs(
            rawData,
            trackedPendingIds,
            activeAccountScope,
          );
          if (recovered.length > 0) {
            const stillTrackedIds = new Set(allTrackedTxs.map((tx) => tx.id));
            for (const tx of recovered) {
              if (!stillTrackedIds.has(tx.id)) allTrackedTxs.push(tx);
            }
          }
        }

        allTrackedTxs.sort(
          (a, b) =>
            (b.decodedTx?.createdAt || 0) - (a.decodedTx?.createdAt || 0),
        );
        const history = allTrackedTxs;
        if (history?.length) {
          trayData.pendingTxs = history.map((tx): IPendingTx => {
            const decodedTx = tx.decodedTx;
            const action = decodedTx
              ? (getDisplayedActions({ decodedTx })[0] ??
                decodedTx.actions?.[0])
              : undefined;
            const transfer = action?.assetTransfer;
            const txType = getTrayPendingTxType({ decodedTx, action });

            // Don't fall back to totalFeeFiatValue: gas fee is not the tx amount (OK-53607).
            const amount = formatTrayPendingTxAmount({
              amountInfo: getTrayPendingTxAmountInfo(action),
            });

            const to =
              action?.tokenApprove?.spender ||
              transfer?.sends?.[0]?.to ||
              action?.functionCall?.to ||
              action?.unknownAction?.to ||
              decodedTx?.to ||
              '';

            const status: 'pending' | 'failed' =
              decodedTx?.status === EDecodedTxStatus.Failed
                ? 'failed'
                : 'pending';

            return {
              id: decodedTx?.txid || tx.id || '',
              historyId: tx.id,
              accountId: decodedTx?.accountId,
              networkId: decodedTx?.networkId,
              historyTx: tx,
              type: txType,
              to,
              amount,
              createdAt: decodedTx?.createdAt,
              updatedAt: decodedTx?.updatedAt,
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

      hasPendingTxRef.current = (trayData.pendingTxs ?? []).some(
        (tx) => tx.status === 'pending',
      );
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
        wallet: buildTrayWalletInfo(walletRef.current, 'Wallet'),
        account: buildTrayAccountInfo({
          accountName: accountNameRef.current,
          account: accountRef.current,
          indexedAccount: indexedAccountRef.current,
          dbAccount: dbAccountRef.current,
        }),
        totalBalance: {
          amount: '0.00',
          currency: displayCurrency,
          symbol: displaySymbol,
        },
        watchlist: [],
        pendingTxs: [],
      });
      pendingTxsClearedRef.current = false;
    }
  }, []);

  const clearPendingRecheck = useCallback(() => {
    if (pendingRecheckTimerRef.current) {
      clearTimeout(pendingRecheckTimerRef.current);
      pendingRecheckTimerRef.current = null;
    }
  }, []);

  // Resets on every refresh so external events near a tick don't cause back-to-back gathers.
  const schedulePendingRecheck = useCallback(() => {
    if (!isTrayActiveRef.current) return;
    if (pendingRecheckTimerRef.current) {
      clearTimeout(pendingRecheckTimerRef.current);
    }
    pendingRecheckTimerRef.current = setTimeout(() => {
      pendingRecheckTimerRef.current = null;
      void handleTrayDataRequestRef.current?.();
    }, TRAY_PENDING_TX_RECHECK_INTERVAL_MS);
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
      const willTrailingRefresh = trailingRefreshRef.current;
      if (willTrailingRefresh) {
        trailingRefreshRef.current = false;
        // Microtask so the call stack unwinds and main-process
        // `guardedRequest` can release on TRAY_DATA_RESPONSE first.
        queueMicrotask(() => {
          void handleTrayDataRequestRef.current?.();
        });
      } else if (hasPendingTxRef.current) {
        schedulePendingRecheck();
      } else {
        clearPendingRecheck();
      }
    }
  }, [handleTrayDataRequestInner, schedulePendingRecheck, clearPendingRecheck]);

  const handleOpenTransactionDetail = useCallback(
    async (action: ITrayAction) => {
      try {
        const historyTx = await findTrayHistoryTxByAction(action);
        const decodedTx = historyTx?.decodedTx;
        if (!historyTx || !decodedTx?.accountId || !decodedTx.networkId) return;

        const nav = rootNavigationRef.current;
        if (!nav) return;

        nav.navigate(ERootRoutes.Modal, {
          screen: EModalRoutes.MainModal,
          params: {
            screen: EModalAssetDetailRoutes.HistoryDetails,
            params: {
              accountId: decodedTx.accountId,
              networkId: decodedTx.networkId,
              historyTx,
              checkIsFocused: false,
            },
          },
        });
      } catch (e) {
        defaultLogger.app.error.log(
          `[TrayDataProvider] transaction navigation error: ${
            (e as Error)?.message || String(e)
          }`,
        );
      }
    },
    [],
  );

  // addIpcEventListener strips the IpcRendererEvent, so the action payload
  // is the first (and only) argument to this handler.
  const handleTrayNavigation = useCallback(
    (action: ITrayAction) => {
      const nav = rootNavigationRef.current;
      if (!nav) return;

      if (action?.type === 'open-page') {
        if (action.route === TRAY_ROUTE_HOME) {
          resetAboveMainRoute();
          setTimeout(resetAboveMainRoute, 120);
          nav.navigate(ERootRoutes.Main, {
            screen: ETabRoutes.Home,
          });
        } else if (action.route === TRAY_ROUTE_MARKET) {
          resetAboveMainRoute();
          setTimeout(resetAboveMainRoute, 120);
          void switchTabAsync(ETabRoutes.Market).then(() => {
            rootNavigationRef.current?.navigate(
              ERootRoutes.Main,
              {
                screen: ETabRoutes.Market,
                params: {
                  screen: ETabMarketRoutes.TabMarket,
                },
              },
              {
                pop: true,
              },
            );
          });
        }
        return;
      }

      if (action?.type === 'transaction-detail') {
        void handleOpenTransactionDetail(action);
        return;
      }

      if (action?.type === 'view-all-transactions') {
        nav.navigate(ERootRoutes.Main, {
          screen: ETabRoutes.Home,
        });
        // Delay lets HomePageView mount its SwitchWalletHomeTab listener
        // before we emit.
        setTimeout(() => {
          appEventBus.emit(EAppEventBusNames.SwitchWalletHomeTab, {
            id: EHomeWalletTab.History,
          });
        }, 80);
        return;
      }

      if (action?.type === 'market-detail-v2') {
        if (action.perpsCoin) {
          const coin = action.perpsCoin;
          setTimeout(async () => {
            nav.navigate(ERootRoutes.Main, {
              screen: ETabRoutes.Perp,
            });
            try {
              await backgroundApiProxy.serviceHyperliquid.changeActiveAsset({
                coin,
              });
            } catch (e) {
              defaultLogger.app.error.log(
                `[TrayDataProvider] perps navigation error: ${
                  (e as Error)?.message || String(e)
                }`,
              );
            }
            appEventBus.emit(EAppEventBusNames.PerpSwitchActiveInstrument, {
              mode: 'perp',
              coin,
            });
          }, 80);
          return;
        }

        const isNative = action.isNative || false;
        if (action.networkId && (isNative || action.tokenAddress)) {
          const networkId = action.networkId;
          const shortCode = networkUtils.getNetworkShortCode({ networkId });
          const target = getTrayMarketNavigationTarget({
            network: shortCode || networkId,
            tokenAddress: action.tokenAddress,
            isNative,
          });
          if (!target) return;

          void switchTabAsync(ETabRoutes.Market).then(() => {
            rootNavigationRef.current?.navigate(
              ERootRoutes.Main,
              {
                screen: ETabRoutes.Market,
                params: {
                  screen: ETabMarketRoutes.TabMarket,
                },
              },
              {
                pop: true,
              },
            );

            setTimeout(() => {
              rootNavigationRef.current?.navigate(ERootRoutes.Main, {
                screen: ETabRoutes.Market,
                params: {
                  screen: target.screen,
                  params: target.params,
                },
              });
            }, 100);
          });
        }
      }
    },
    [handleOpenTransactionDetail],
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

  // Account switch: optimistic placeholder + immediate gather (OK-53623).
  // Non-switch identity changes stay debounced to absorb OK-53610 cascade.
  useEffect(() => {
    if (!isTrayActive) return;
    const currentAccountId = activeAccountValue?.accountId;
    const accountJustChanged = currentAccountId !== prevAccountIdRef.current;
    if (accountJustChanged) {
      prevAccountIdRef.current = currentAccountId;
      const { displayCurrency, displaySymbol } = getTrayCurrencyDisplayInfo({
        currencyInfo,
        currencyMap,
      });
      globalThis.desktopApi?.sendTrayData({
        accountId: currentAccountId,
        pendingTxsCleared: false,
        // Empty name triggers TrayPanel's `noWallet` branch, hiding the optimistic zeros.
        wallet: buildTrayWalletInfo(walletRef.current, 'Wallet'),
        account: buildTrayAccountInfo({
          accountName: accountNameRef.current,
          account: accountRef.current,
          indexedAccount: indexedAccountRef.current,
          dbAccount: dbAccountRef.current,
        }),
        totalBalance: {
          amount: '0.00',
          currency: displayCurrency,
          symbol: displaySymbol,
        },
        watchlist: lastWatchlistRef.current,
        pendingTxs: [],
      });
      handleTrayDataRequestRef.current?.();
      return;
    }
    const timer = setTimeout(() => {
      handleTrayDataRequestRef.current?.();
    }, 300);
    return () => clearTimeout(timer);
  }, [isTrayActive, activeAccountValue, currencyInfo, currencyMap]);

  useEffect(() => {
    if (!isTrayActive) return;
    handleTrayDataRequestRef.current?.();
  }, [isTrayActive, appIsLocked]);

  useEffect(() => {
    if (!isTrayActive) return;
    handleTrayDataRequestRef.current?.();
  }, [isTrayActive, settingsLocale, settingsLastLocale]);

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

  useEffect(() => {
    if (!isTrayActive) {
      clearPendingRecheck();
      hasPendingTxRef.current = false;
    }
    return () => {
      clearPendingRecheck();
    };
  }, [isTrayActive, clearPendingRecheck]);
}
