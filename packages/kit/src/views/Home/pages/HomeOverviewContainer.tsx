import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import {
  settingsValuePersistAtom,
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import { SHOW_WALLET_FUNCTION_BLOCK_VALUE_THRESHOLD_USD } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { perfMark } from '@onekeyhq/shared/src/performance/mark';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  calculateAccountTokensValue,
  calculateAccountTotalValue,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import { EHomeTab } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import NumberSizeableTextWrapper from '../../../components/NumberSizeableTextWrapper';
import { showResourceDetailsDialog } from '../../../components/Resource';
import { useDebounce } from '../../../hooks/useDebounce';
import {
  useAccountDeFiOverviewAtom,
  useAccountOverviewActions,
  useAccountOverviewStateAtom,
  useAccountWorthAtom,
  useAllNetworksStateStateAtom,
  useLastConfirmedOverviewBalanceAtom,
  useOverviewDeFiDataStateAtom,
  useOverviewTokenCacheStateAtom,
} from '../../../states/jotai/contexts/accountOverview';
import { buildOverviewOwnerKey } from '../../../states/jotai/contexts/accountOverview/atoms';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { convertFiat } from '../../../utils/fiatConvert';
import { showBalanceDetailsDialog } from '../components/BalanceDetailsDialog';
import { HomeTestIDs } from '../testIDs';

// Grace period (ms) after an account switch during which the previous
// balance is shown as a placeholder to avoid a skeleton flash.
const BALANCE_REUSE_GRACE_MS = 180;

const HOME_OVERVIEW_REFRESH_TABS = [
  EHomeTab.TOKENS,
  EHomeTab.NFT,
  EHomeTab.HISTORY,
  EHomeTab.DEFI,
] as const;

type IHomeOverviewRefreshTab = (typeof HOME_OVERVIEW_REFRESH_TABS)[number];

function isHomeOverviewRefreshTab(
  type: EHomeTab,
): type is IHomeOverviewRefreshTab {
  return HOME_OVERVIEW_REFRESH_TABS.includes(type as IHomeOverviewRefreshTab);
}

function HomeOverviewContainer() {
  const num = 0;
  const { activeAccount } = useActiveAccount({ num });
  const { account, network, wallet, deriveInfoItems, vaultSettings } =
    activeAccount;
  const resourceDialogInstance = useRef<IDialogInstance | null>(null);
  const handleResourceDetailsOnPress = useCallback(() => {
    if (resourceDialogInstance.current) return;
    resourceDialogInstance.current = showResourceDetailsDialog({
      accountId: account?.id ?? '',
      networkId: network?.id ?? '',
      onClose: () => {
        resourceDialogInstance.current = null;
      },
    });
  }, [account?.id, network?.id]);
  const intl = useIntl();

  const [isRefreshingWorth, setIsRefreshingWorth] = useState(false);
  const [isRefreshingTokenList, setIsRefreshingTokenList] = useState(false);
  const [isRefreshingNftList, setIsRefreshingNftList] = useState(false);
  const [isRefreshingDeFiList, setIsRefreshingDeFiList] = useState(false);
  const [isRefreshingHistoryList, setIsRefreshingHistoryList] = useState(false);

  const listRefreshKeys = useRef<
    Partial<Record<IHomeOverviewRefreshTab, string>>
  >({});

  const [accountWorth] = useAccountWorthAtom();
  const [accountDeFiOverview] = useAccountDeFiOverviewAtom();
  const [overviewState] = useAccountOverviewStateAtom();
  const [allNetworksState] = useAllNetworksStateStateAtom();
  const [lastConfirmedOverviewBalance, setLastConfirmedOverviewBalance] =
    useLastConfirmedOverviewBalanceAtom();
  const [overviewTokenCacheState] = useOverviewTokenCacheStateAtom();
  const [overviewDeFiDataState] = useOverviewDeFiDataStateAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  // Mirrors `currencyMap` so background effects can read the latest rates
  // without being reactive to every periodic rate refresh — putting
  // `currencyMap` directly in a worth-persist effect's deps would re-fire
  // SimpleDB writes every time rates poll, even when the underlying worth
  // hasn't changed.
  const currencyMapRef = useRef(currencyMap);
  useEffect(() => {
    currencyMapRef.current = currencyMap;
  }, [currencyMap]);
  const {
    updateAccountOverviewState,
    updateAccountWorth,
    updateAccountDeFiOverview,
  } = useAccountOverviewActions().current;

  const [settings] = useSettingsPersistAtom();

  const isWalletNotBackedUp = useMemo(() => {
    if (wallet && wallet.type === WALLET_TYPE_HD && !wallet.backuped) {
      return true;
    }
    return false;
  }, [wallet]);

  // Bypass token-cache/DeFi-ready gating during the first ~500ms after cold-start
  // mount: if we have a locally-cached `lastConfirmedOverviewBalance.latest`,
  // show it immediately. Empirically, waiting for BG to flip hasCache/isReady
  // costs ~300ms on real device and contributes most of the Window-2 gap from
  // canDismissSplash=true to Balance displayed. After the window expires, the
  // original gate logic (BALANCE_REUSE_GRACE_MS + hasPositiveCurrentOwnerSignal)
  // takes over for account-switch scenarios.
  //
  // Gated on the session-level `__onekeyBalanceDisplayed` flag (set on the
  // first balance render) so the fast path only fires on the actual cold-start
  // mount, not on every fresh mount triggered by Tabs.Container remount during
  // network/account switches — otherwise the previous owner's `.latest` value
  // briefly leaks into the new owner's overview.
  const isFirstColdStartMountRef = useRef(
    !(globalThis as any).__onekeyBalanceDisplayed,
  );
  useEffect(() => {
    const t = setTimeout(() => {
      isFirstColdStartMountRef.current = false;
    }, 500);
    return () => clearTimeout(t);
  }, []);

  // Synchronously read the MMKV-hydrated atom snapshot to compute the effective
  // owner key on first render. accountSelector atoms are ColdStartCache-backed,
  // so the snapshot at bootstrap contains the last known selected account.
  // Without this, currentOverviewOwnerKey is '' for 1-3 React commits while the
  // accountSelector atom propagates to HomeOverview, and
  // lastConfirmedOverviewBalance.byOwner[''] returns undefined — delaying the
  // first balance display.
  const bootstrapOwnerKey = useMemo(() => {
    try {
      const snap = (globalThis as any).__ONEKEY_CTX_ATOM_SNAPSHOT__ as
        | Record<string, unknown>
        | undefined;
      if (!snap) return '';
      // Read from activeAccountsAtom (not selectedAccountsAtom): byOwner keys
      // are built via buildOverviewOwnerKey(account.id, network.id) where
      // account.id is the fully-derived form (e.g. "hd-1--0000/0"), while
      // selectedAccountsAtom only exposes indexedAccountId ("hd-1--0"). Using
      // the latter would never match any byOwner entry, making the first-frame
      // balance fast-path dead code. activeAccountsAtom is ColdStartCache-
      // backed so its snapshot is present at bootstrap; see SplashProvider
      // hasBalanceCacheInSnapshot() for the mirrored lookup.
      const activeKey = Object.keys(snap).find(
        (key) =>
          key.includes('accountSelector@home') &&
          key.includes('ctx:activeAccountsAtom'),
      );
      if (!activeKey) return '';
      const raw = snap[activeKey];
      if (!raw || typeof raw !== 'object') return '';
      // activeAccountsAtom shape: { '<num>': { account: { id }, network: { id }, ... } }
      // Home scene uses num=0 by convention.
      const atZero = (raw as Record<string, any>)['0'];
      if (!atZero || typeof atZero !== 'object') return '';
      const accountId: string | undefined = atZero.account?.id;
      const networkId: string | undefined = atZero.network?.id;
      if (!accountId || !networkId) return '';
      return buildOverviewOwnerKey(accountId, networkId);
    } catch {
      return '';
    }
  }, []);

  useEffect(() => {
    perfMark('Home:overview:mount');
    return () => {
      perfMark('Home:overview:unmount');
    };
  }, []);

  const prevWalletIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (account?.id && network?.id && wallet?.id) {
      const walletChanged =
        prevWalletIdRef.current !== undefined &&
        prevWalletIdRef.current !== wallet.id;
      prevWalletIdRef.current = wallet.id;

      if (
        walletChanged ||
        network.isAllNetworks ||
        (wallet.type === WALLET_TYPE_HD && !wallet.backuped)
      ) {
        updateAccountWorth({
          accountId: account.id,
          worth: {},
          initialized: false,
        });
        updateAccountDeFiOverview({
          accountId: account.id,
          networkId: network.id,
          overview: {
            totalValue: 0,
            totalDebt: 0,
            totalReward: 0,
            netWorth: 0,
          },
        });
      }
    }
  }, [
    account?.id,
    network?.id,
    network?.isAllNetworks,
    updateAccountDeFiOverview,
    updateAccountOverviewState,
    updateAccountWorth,
    wallet?.backuped,
    wallet?.id,
    wallet?.type,
  ]);

  useEffect(() => {
    const refreshStateSetters: Record<
      IHomeOverviewRefreshTab,
      (isRefreshing: boolean) => void
    > = {
      [EHomeTab.TOKENS]: setIsRefreshingTokenList,
      [EHomeTab.NFT]: setIsRefreshingNftList,
      [EHomeTab.HISTORY]: setIsRefreshingHistoryList,
      [EHomeTab.DEFI]: setIsRefreshingDeFiList,
    };

    const syncWorthRefreshingState = () => {
      setIsRefreshingWorth(
        HOME_OVERVIEW_REFRESH_TABS.some((refreshType) =>
          Boolean(listRefreshKeys.current[refreshType]),
        ),
      );
    };

    const updateRefreshState = ({
      refreshType,
      isRefreshing,
      key,
    }: {
      refreshType: IHomeOverviewRefreshTab;
      isRefreshing: boolean;
      key: string;
    }) => {
      if (isRefreshing) {
        listRefreshKeys.current[refreshType] = key;
        refreshStateSetters[refreshType](true);
        return true;
      }

      if (
        listRefreshKeys.current[refreshType] &&
        listRefreshKeys.current[refreshType] !== key
      ) {
        return false;
      }

      delete listRefreshKeys.current[refreshType];
      refreshStateSetters[refreshType](false);
      return true;
    };

    const fn = ({
      isRefreshing,
      type,
      accountId,
      networkId,
    }: {
      isRefreshing: boolean;
      type: EHomeTab;
      accountId: string;
      networkId: string;
    }) => {
      const key = `${accountId}-${networkId}`;
      let didUpdateState = false;

      if (type === EHomeTab.ALL) {
        HOME_OVERVIEW_REFRESH_TABS.forEach((refreshType) => {
          didUpdateState =
            updateRefreshState({ refreshType, isRefreshing, key }) ||
            didUpdateState;
        });
      } else if (isHomeOverviewRefreshTab(type)) {
        didUpdateState = updateRefreshState({
          refreshType: type,
          isRefreshing,
          key,
        });
      }

      if (!didUpdateState) {
        return;
      }

      syncWorthRefreshingState();
      if (isRefreshing) {
        perfMark(`Home:refresh:start:${type}`, {
          refreshType: type,
        });
      } else {
        perfMark(`Home:done:${type}`, {
          refreshType: type,
        });
        perfMark(`Home:refresh:done:${type}`, {
          refreshType: type,
        });
      }
    };
    appEventBus.on(EAppEventBusNames.TabListStateUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.TabListStateUpdate, fn);
    };
  }, []);

  useEffect(() => {
    listRefreshKeys.current = {};
    setIsRefreshingWorth(false);
    setIsRefreshingTokenList(false);
    setIsRefreshingNftList(false);
    setIsRefreshingHistoryList(false);
    setIsRefreshingDeFiList(false);
  }, [account?.id, account?.indexedAccountId, network?.id, wallet?.id]);

  useEffect(() => {
    const updateAccountValue = async () => {
      if (
        account &&
        network &&
        accountWorth.initialized &&
        (account.id === accountWorth.accountId ||
          account.indexedAccountId === accountWorth.accountId)
      ) {
        const allWorth = Object.values(accountWorth.worth)
          .reduce<BigNumber>((acc, cur) => acc.plus(cur), new BigNumber(0))
          .toFixed();
        // Threshold is "_USD" so compare in USD basis. currencyMap is read
        // via the ref so periodic rate refreshes don't re-trigger this effect.
        const allWorthUsd = convertFiat({
          value: allWorth,
          sourceCurrency: accountWorth.currency ?? settings.currencyInfo.id,
          targetCurrency: USD_CURRENCY_ID,
          currencyMap: currencyMapRef.current,
        });

        if (
          new BigNumber(allWorthUsd).gt(
            SHOW_WALLET_FUNCTION_BLOCK_VALUE_THRESHOLD_USD,
          )
        ) {
          await backgroundApiProxy.serviceWalletStatus.updateWalletStatus({
            walletXfp: wallet?.xfp ?? '',
            status: {
              hasValue: true,
            },
          });
          appEventBus.emit(EAppEventBusNames.AccountValueUpdate, undefined);
        }
        const isOthers = accountUtils.isOthersAccount({
          accountId: account.id,
        });
        // Logical account id for the active value atom & rookie guide: matches
        // the keying convention used by the account selector (indexedAccountId
        // for HD/HW, account.id for Others).
        const accountValueId = isOthers
          ? account.id
          : (account.indexedAccountId as string);

        // ServiceAccountProfile.convertMapToUsd uses this tag to reverse the
        // conversion back to USD before persisting — passing the wrong tag
        // here would re-divide a USD value by a foreign rate and corrupt the
        // accountValue SimpleDB.
        const accountWorthCurrency =
          accountWorth.currency ?? settings.currencyInfo.id;
        if (isOthers) {
          if (
            account.createAtNetwork &&
            (network.isAllNetworks || account.createAtNetwork === network.id)
          ) {
            void backgroundApiProxy.serviceAccountProfile.updateAccountValue({
              accountId: accountValueId,
              networkAccountId: account.id,
              networkId: account.createAtNetwork,
              value: accountWorth.createAtNetworkWorth,
              currency: accountWorthCurrency,
              shouldUpdateActiveAccountValue: true,
            });
          }
        } else if (!network.isAllNetworks) {
          const singleNetworkValue =
            accountWorth.worth[
              accountUtils.buildAccountValueKey({
                accountId: account.id,
                networkId: network.id,
              })
            ];
          void backgroundApiProxy.serviceAccountProfile.updateAccountValueForSingleNetwork(
            {
              accountId: accountValueId,
              networkAccountId: account.id,
              networkId: network.id,
              value: singleNetworkValue ?? '0',
              currency: accountWorthCurrency,
            },
          );
        }

        void backgroundApiProxy.serviceAccountProfile.updateAllNetworkAccountValue(
          {
            accountId: accountValueId,
            value: accountWorth.worth,
            currency: accountWorthCurrency,
            updateAll: accountWorth.updateAll,
          },
        );
      }
    };
    void updateAccountValue();
  }, [
    account,
    accountWorth,
    accountWorth.accountId,
    accountWorth.createAtNetworkWorth,
    accountWorth.initialized,
    accountWorth.updateAll,
    accountWorth.worth,
    network,
    settings.currencyInfo.id,
    wallet,
  ]);

  const balanceDialogInstance = useRef<IDialogInstance | null>(null);

  const handleRefreshWorth = useCallback(() => {
    if (isRefreshingWorth) return;
    setIsRefreshingWorth(true);
    appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
    defaultLogger.account.wallet.walletManualRefresh();
  }, [isRefreshingWorth]);

  const isLoading =
    isRefreshingWorth ||
    isRefreshingTokenList ||
    isRefreshingNftList ||
    isRefreshingHistoryList ||
    isRefreshingDeFiList;

  const refreshButton = useMemo(() => {
    return platformEnv.isNative || isWalletNotBackedUp ? undefined : (
      <IconButton
        icon="RefreshCcwOutline"
        variant="tertiary"
        loading={isLoading}
        onPress={handleRefreshWorth}
        testID="wallet-refresh-manually"
        trackID="wallet-refresh-manually"
      />
    );
  }, [handleRefreshWorth, isLoading, isWalletNotBackedUp]);

  const handleBalanceOnPress = useCallback(async () => {
    const settingsValue = await settingsValuePersistAtom.get();
    await settingsValuePersistAtom.set({ hideValue: !settingsValue.hideValue });
  }, []);

  const handleBalanceDetailsOnPress = useCallback(() => {
    if (balanceDialogInstance?.current) {
      return;
    }
    balanceDialogInstance.current = showBalanceDetailsDialog({
      accountId: account?.id ?? '',
      networkId: network?.id ?? '',
      deriveInfoItems,
      indexedAccountId: account?.indexedAccountId,
      intl,
      onClose: () => {
        balanceDialogInstance.current = null;
      },
    });
  }, [account, network, deriveInfoItems, intl]);

  const currentWorthKey = useMemo(() => {
    if (!account?.id || !network?.id || network.isAllNetworks) {
      return undefined;
    }

    return accountUtils.buildAccountValueKey({
      accountId: account.id,
      networkId: network.id,
    });
  }, [account?.id, network?.id, network?.isAllNetworks]);

  const currentOverviewOwnerKey = useMemo(
    () => buildOverviewOwnerKey(account?.id, network?.id),
    [account?.id, network?.id],
  );

  const isCurrentAccountWorthReady = useMemo(() => {
    if (!account?.id || !network?.id) {
      return false;
    }

    if (
      !accountWorth.accountId ||
      (accountWorth.accountId !== (account?.id ?? '') &&
        accountWorth.accountId !== (account?.indexedAccountId ?? ''))
    ) {
      return false;
    }

    if (network.isAllNetworks || vaultSettings?.mergeDeriveAssetsEnabled) {
      // Has actual worth data from at least one network
      if (Object.keys(accountWorth.worth).length > 0) {
        return true;
      }
      // All networks confirmed loaded with no data
      return accountWorth.initialized && !!accountWorth.updateAll;
    }

    if (!currentWorthKey) {
      return false;
    }

    return Object.prototype.hasOwnProperty.call(
      accountWorth.worth,
      currentWorthKey,
    );
  }, [
    account?.id,
    account?.indexedAccountId,
    network?.id,
    network?.isAllNetworks,
    accountWorth.accountId,
    accountWorth.initialized,
    accountWorth.updateAll,
    accountWorth.worth,
    currentWorthKey,
    vaultSettings?.mergeDeriveAssetsEnabled,
  ]);

  const isCurrentAccountDeFiReady = useMemo(() => {
    if (!account?.id || !network?.id) {
      return false;
    }

    return (
      overviewDeFiDataState.ownerKey === currentOverviewOwnerKey &&
      overviewDeFiDataState.isReady !== undefined
    );
  }, [
    account?.id,
    network?.id,
    currentOverviewOwnerKey,
    overviewDeFiDataState.isReady,
    overviewDeFiDataState.ownerKey,
  ]);

  // Returns a USD-basis string. DeFi data arrives in display currency from
  // DeFiListBlock, so it's converted back to USD here before summing.
  const resolvedBalanceString = useMemo(() => {
    const isAllNetworks = !!network?.isAllNetworks;

    // All Networks: show partial results as each network loads in.
    // Single network: require both token worth and DeFi to be ready.
    if (isAllNetworks) {
      if (!isCurrentAccountWorthReady && !isCurrentAccountDeFiReady) {
        return undefined;
      }
    } else if (!isCurrentAccountWorthReady || !isCurrentAccountDeFiReady) {
      return undefined;
    }

    const tokenWorth =
      !isAllNetworks || isCurrentAccountWorthReady
        ? calculateAccountTokensValue({
            accountId: account?.id ?? '',
            networkId: network?.id ?? '',
            tokensWorth: accountWorth,
            mergeDeriveAssetsEnabled: !!vaultSettings?.mergeDeriveAssetsEnabled,
          })
        : '0';
    const tokenWorthUsd = convertFiat({
      value: tokenWorth,
      sourceCurrency: accountWorth.currency ?? settings.currencyInfo.id,
      targetCurrency: USD_CURRENCY_ID,
      currencyMap,
    });

    const deFiWorthRaw =
      !isAllNetworks || isCurrentAccountDeFiReady
        ? (accountDeFiOverview.netWorth ?? 0)
        : 0;
    const deFiWorthUsd = convertFiat({
      value: deFiWorthRaw,
      sourceCurrency: accountDeFiOverview.currency || settings.currencyInfo.id,
      targetCurrency: USD_CURRENCY_ID,
      currencyMap,
    });

    return calculateAccountTotalValue({
      tokensValue: tokenWorthUsd,
      deFiNetWorth: deFiWorthUsd,
    });
  }, [
    account?.id,
    network?.id,
    accountWorth,
    accountDeFiOverview.netWorth,
    accountDeFiOverview.currency,
    currencyMap,
    isCurrentAccountDeFiReady,
    isCurrentAccountWorthReady,
    network?.isAllNetworks,
    settings.currencyInfo.id,
    vaultSettings?.mergeDeriveAssetsEnabled,
  ]);

  const isCurrentAllNetworksBalanceFullyReady =
    !network?.isAllNetworks ||
    (isCurrentAccountWorthReady && isCurrentAccountDeFiReady);

  const [reuseLatestBalanceGraceExpired, setReuseLatestBalanceGraceExpired] =
    useState(false);
  useEffect(() => {
    setReuseLatestBalanceGraceExpired(false);
    const timer = setTimeout(() => {
      setReuseLatestBalanceGraceExpired(true);
    }, BALANCE_REUSE_GRACE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [currentOverviewOwnerKey]);

  useEffect(() => {
    if (
      resolvedBalanceString !== undefined &&
      currentOverviewOwnerKey &&
      isCurrentAllNetworksBalanceFullyReady
    ) {
      setLastConfirmedOverviewBalance((prev) => ({
        latest: resolvedBalanceString,
        byOwner: {
          ...prev.byOwner,
          [currentOverviewOwnerKey]: resolvedBalanceString,
        },
        currency: USD_CURRENCY_ID,
      }));
    }
  }, [
    currentOverviewOwnerKey,
    isCurrentAllNetworksBalanceFullyReady,
    resolvedBalanceString,
    setLastConfirmedOverviewBalance,
  ]);

  const effectiveOwnerKey = currentOverviewOwnerKey || bootstrapOwnerKey;
  // Pre-migration hydrate has no currency tag; values were written in the
  // user's then-active display currency.
  const lastConfirmedCurrency =
    lastConfirmedOverviewBalance.currency ?? settings.currencyInfo.id;
  const rawCurrentConfirmedBalance =
    lastConfirmedOverviewBalance.byOwner[effectiveOwnerKey];
  const currentConfirmedBalance = rawCurrentConfirmedBalance
    ? convertFiat({
        value: rawCurrentConfirmedBalance,
        sourceCurrency: lastConfirmedCurrency,
        targetCurrency: USD_CURRENCY_ID,
        currencyMap,
      })
    : undefined;
  const isCurrentTokenCacheStateMatched =
    overviewTokenCacheState.ownerKey === currentOverviewOwnerKey;
  const isCurrentDeFiDataStateMatched =
    overviewDeFiDataState.ownerKey === currentOverviewOwnerKey;
  // Determines whether we can show the most-recently-displayed balance as a
  // placeholder while the new account's data is still loading.
  // This avoids a jarring skeleton flash during quick account switches.
  const canReuseLatestDisplayedBalance = useMemo(() => {
    // Already have a confirmed balance for this account — no need to reuse.
    if (currentConfirmedBalance || !lastConfirmedOverviewBalance.latest) {
      return false;
    }
    if (isWalletNotBackedUp) {
      return false;
    }
    // First-mount fast path: see comment on isFirstColdStartMountRef.
    if (isFirstColdStartMountRef.current) {
      return true;
    }
    const hasPositiveCurrentOwnerSignal =
      (isCurrentTokenCacheStateMatched &&
        overviewTokenCacheState.hasCache === true) ||
      (isCurrentDeFiDataStateMatched && overviewDeFiDataState.isReady === true);
    if (!hasPositiveCurrentOwnerSignal) {
      return false;
    }
    return !reuseLatestBalanceGraceExpired;
  }, [
    currentConfirmedBalance,
    isWalletNotBackedUp,
    isCurrentDeFiDataStateMatched,
    isCurrentTokenCacheStateMatched,
    lastConfirmedOverviewBalance.latest,
    overviewDeFiDataState.isReady,
    overviewTokenCacheState.hasCache,
    reuseLatestBalanceGraceExpired,
  ]);

  // During All Networks progressive loading, hold the previous confirmed
  // balance until both token and DeFi data finish loading.
  const shouldHoldCurrentConfirmedBalance =
    !!network?.isAllNetworks &&
    !!currentConfirmedBalance &&
    !isCurrentAllNetworksBalanceFullyReady;

  const lastConfirmedLatestUsd =
    canReuseLatestDisplayedBalance && lastConfirmedOverviewBalance.latest
      ? convertFiat({
          value: lastConfirmedOverviewBalance.latest,
          sourceCurrency: lastConfirmedCurrency,
          targetCurrency: USD_CURRENCY_ID,
          currencyMap,
        })
      : undefined;
  const displayBalanceString = shouldHoldCurrentConfirmedBalance
    ? currentConfirmedBalance
    : (resolvedBalanceString ??
      currentConfirmedBalance ??
      lastConfirmedLatestUsd);

  const balancePayload = useMemo(
    () => ({
      ownerKey: currentOverviewOwnerKey,
      value: displayBalanceString,
    }),
    [currentOverviewOwnerKey, displayBalanceString],
  );
  // leading:true fires immediately so a fresh balance isn't held back by
  // the 100ms tail; trailing:true preserves the de-duplication on rapid
  // back-to-back updates. This removes up to 100ms of cold-start latency
  // on the balance display path.
  const debouncedBalancePayload = useDebounce(balancePayload, 100, {
    leading: true,
    trailing: true,
  });

  const numberFormatter: INumberFormatProps = {
    formatter: 'value',
    formatterOptions: { currency: settings.currencyInfo.symbol },
  };

  const hasDisplayableOverviewBalance =
    shouldHoldCurrentConfirmedBalance ||
    resolvedBalanceString !== undefined ||
    !!currentConfirmedBalance ||
    canReuseLatestDisplayedBalance;

  const shouldDisplayZeroBalancePlaceholder = useMemo(() => {
    if (
      !overviewState.initialized ||
      overviewState.isRefreshing ||
      hasDisplayableOverviewBalance
    ) {
      return false;
    }

    if (isWalletNotBackedUp) {
      return true;
    }

    if (!network?.isAllNetworks) {
      return true;
    }

    return (
      isCurrentTokenCacheStateMatched &&
      isCurrentDeFiDataStateMatched &&
      allNetworksState.visibleCount === 0 &&
      overviewTokenCacheState.hasCache === false &&
      overviewDeFiDataState.isReady === true
    );
  }, [
    allNetworksState.visibleCount,
    hasDisplayableOverviewBalance,
    isCurrentDeFiDataStateMatched,
    isCurrentTokenCacheStateMatched,
    isWalletNotBackedUp,
    network?.isAllNetworks,
    overviewDeFiDataState.isReady,
    overviewState.initialized,
    overviewState.isRefreshing,
    overviewTokenCacheState.hasCache,
  ]);

  const showSkeleton =
    !hasDisplayableOverviewBalance && !shouldDisplayZeroBalancePlaceholder;

  const debouncedBalanceString =
    debouncedBalancePayload.ownerKey === currentOverviewOwnerKey
      ? debouncedBalancePayload.value
      : undefined;

  const renderedBalanceString = displayBalanceString ?? debouncedBalanceString;

  // The single USD → display-currency conversion point; a currency switch
  // reflows the visible balance without touching cached state.
  const renderedBalanceStringDisplay = useMemo(() => {
    if (renderedBalanceString === undefined || renderedBalanceString === null) {
      return renderedBalanceString;
    }
    return convertFiat({
      value: renderedBalanceString,
      sourceCurrency: USD_CURRENCY_ID,
      targetCurrency: settings.currencyInfo.id,
      currencyMap,
    });
  }, [renderedBalanceString, settings.currencyInfo.id, currencyMap]);

  // Track when balance is first displayed
  const balanceReady =
    !showSkeleton &&
    renderedBalanceString !== null &&
    renderedBalanceString !== undefined;
  useEffect(() => {
    if (balanceReady && !(globalThis as any).__onekeyBalanceDisplayed) {
      (globalThis as any).__onekeyBalanceDisplayed = true;
      appEventBus.emit(EAppEventBusNames.HomePageReady, undefined);
      // Best-effort: persist the on-screen balance to lastConfirmedOverviewBalance
      // so the NEXT cold start's fast-path (Lever 1 in HomeOverviewContainer) can
      // reuse it without waiting for isCurrentAllNetworksBalanceFullyReady — which
      // often never turns true before the user kills the app in AllNetworks mode.
      // The existing fully-ready-gated useEffect above still runs for progressive
      // updates; this one just guarantees we capture the first-displayed value.
      try {
        const balanceToPersist = renderedBalanceString;
        if (
          balanceToPersist !== undefined &&
          balanceToPersist !== null &&
          currentOverviewOwnerKey
        ) {
          setLastConfirmedOverviewBalance((prev) => ({
            latest: balanceToPersist,
            byOwner: {
              ...prev.byOwner,
              [currentOverviewOwnerKey]: balanceToPersist,
            },
            currency: USD_CURRENCY_ID,
          }));
        }
      } catch {
        /* persistence is best-effort — never break HomePageReady emission */
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { NativeLogger: NL, LogLevel: LL } =
          require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
        const jsEntry: number =
          (globalThis as any).__ONEKEY_MAIN_ENTRY_START__ || 0;
        if (jsEntry) {
          NL.write(
            LL.Info,
            `[StartupTiming] Balance displayed (+${Date.now() - jsEntry}ms)`,
          );
        }
      } catch {
        /* NativeLogger may not be available */
      }
    }
  }, [
    balanceReady,
    currentOverviewOwnerKey,
    renderedBalanceString,
    setLastConfirmedOverviewBalance,
  ]);

  return (
    <YStack
      gap="$2.5"
      alignItems="flex-start"
      testID={HomeTestIDs.walletOverview}
    >
      <YStack w="100%" gap="$2">
        {showSkeleton ? (
          <Skeleton.Heading5Xl />
        ) : (
          <XStack alignItems="center" gap="$3" h={48}>
            <XStack
              flexShrink={1}
              borderRadius="$3"
              px="$1"
              py="$0.5"
              mx="$-1"
              my="$-0.5"
              cursor="default"
              focusable
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              focusVisibleStyle={{
                outlineColor: '$focusRing',
                outlineWidth: 2,
                outlineOffset: 0,
                outlineStyle: 'solid',
              }}
              onPress={handleBalanceOnPress}
              testID={HomeTestIDs.totalBalance}
            >
              <NumberSizeableTextWrapper
                hideValue
                splitDecimal
                flexShrink={1}
                minWidth={0}
                fontSize={48}
                lineHeight={48}
                fontWeight={500}
                {...numberFormatter}
              >
                {renderedBalanceStringDisplay ?? '0'}
              </NumberSizeableTextWrapper>
            </XStack>
            {refreshButton}
          </XStack>
        )}
      </YStack>
      {vaultSettings?.hasFrozenBalance ? (
        <Button
          testID="home-btn"
          onPress={handleBalanceDetailsOnPress}
          variant="tertiary"
          size="small"
          iconAfter="InfoCircleOutline"
        >
          {intl.formatMessage({
            id: ETranslations.balance_detail_button_balance,
          })}
        </Button>
      ) : undefined}
      {isWalletNotBackedUp && vaultSettings?.hasResource ? (
        <Button
          testID="home-btn"
          onPress={handleResourceDetailsOnPress}
          variant="tertiary"
          size="small"
          iconAfter="InfoCircleOutline"
          px="$1"
          py="$0.5"
          mx="$-1"
        >
          {intl.formatMessage({
            id: vaultSettings.resourceKey,
          })}
        </Button>
      ) : undefined}
    </YStack>
  );
}

export { HomeOverviewContainer };
