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
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
import { calculateAccountTokensValue } from '@onekeyhq/shared/src/utils/tokenUtils';
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
import { showBalanceDetailsDialog } from '../components/BalanceDetailsDialog';

// Grace period (ms) after an account switch during which the previous
// balance is shown as a placeholder to avoid a skeleton flash.
const BALANCE_REUSE_GRACE_MS = 180;

function HomeOverviewContainer() {
  const num = 0;
  const {
    activeAccount: { account, network, wallet, deriveInfoItems, vaultSettings },
  } = useActiveAccount({ num });
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

  const listRefreshKey = useRef('');

  const [accountWorth] = useAccountWorthAtom();
  const [accountDeFiOverview] = useAccountDeFiOverviewAtom();
  const [overviewState] = useAccountOverviewStateAtom();
  const [allNetworksState] = useAllNetworksStateStateAtom();
  const [lastConfirmedOverviewBalance, setLastConfirmedOverviewBalance] =
    useLastConfirmedOverviewBalanceAtom();
  const [overviewTokenCacheState] = useOverviewTokenCacheStateAtom();
  const [overviewDeFiDataState] = useOverviewDeFiDataStateAtom();
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
      if (
        !isRefreshing &&
        listRefreshKey.current &&
        listRefreshKey.current !== key
      ) {
        return;
      }

      listRefreshKey.current = key;

      if (type === EHomeTab.ALL) {
        setIsRefreshingTokenList(isRefreshing);
        setIsRefreshingNftList(isRefreshing);
        setIsRefreshingHistoryList(isRefreshing);
        setIsRefreshingWorth(isRefreshing);
        setIsRefreshingDeFiList(isRefreshing);
        return;
      }

      if (type === EHomeTab.TOKENS) {
        setIsRefreshingTokenList(isRefreshing);
      } else if (type === EHomeTab.NFT) {
        setIsRefreshingNftList(isRefreshing);
      } else if (type === EHomeTab.HISTORY) {
        setIsRefreshingHistoryList(isRefreshing);
      } else if (type === EHomeTab.DEFI) {
        setIsRefreshingDeFiList(isRefreshing);
      }
      setIsRefreshingWorth(isRefreshing);
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
    const updateAccountValue = async () => {
      if (
        account &&
        network &&
        accountWorth.initialized &&
        (account.id === accountWorth.accountId ||
          account.indexedAccountId === accountWorth.accountId)
      ) {
        const allWorth = Object.values(accountWorth.worth).reduce(
          (acc: string, cur: string) => new BigNumber(acc).plus(cur).toFixed(),
          '0',
        );

        if (
          new BigNumber(allWorth).gt(
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
        let accountValueId = '';
        if (accountUtils.isOthersAccount({ accountId: account.id })) {
          accountValueId = account.id;

          if (network.isAllNetworks || account.createAtNetwork === network.id) {
            void backgroundApiProxy.serviceAccountProfile.updateAccountValue({
              accountId: accountValueId,
              value: accountWorth.createAtNetworkWorth,
              currency: settings.currencyInfo.id,
              shouldUpdateActiveAccountValue: true,
            });
          }
        } else {
          accountValueId = account.indexedAccountId as string;
        }

        if (
          !accountUtils.isOthersAccount({ accountId: account.id }) &&
          !network.isAllNetworks
        ) {
          void backgroundApiProxy.serviceAccountProfile.updateAccountValueForSingleNetwork(
            {
              accountId: accountValueId,
              value:
                accountWorth.worth[
                  accountUtils.buildAccountValueKey({
                    accountId: account.id,
                    networkId: network.id,
                  })
                ],
              currency: settings.currencyInfo.id,
            },
          );
        }

        void backgroundApiProxy.serviceAccountProfile.updateAllNetworkAccountValue(
          {
            accountId: accountValueId,
            value: accountWorth.worth,
            currency: settings.currencyInfo.id,
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
      onClose: () => {
        balanceDialogInstance.current = null;
      },
    });
  }, [account, network, deriveInfoItems]);

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

    const deFiWorth =
      !isAllNetworks || isCurrentAccountDeFiReady
        ? (accountDeFiOverview.netWorth ?? 0)
        : 0;

    return new BigNumber(tokenWorth).plus(deFiWorth).toFixed();
  }, [
    account?.id,
    network?.id,
    accountWorth,
    accountDeFiOverview.netWorth,
    isCurrentAccountDeFiReady,
    isCurrentAccountWorthReady,
    network?.isAllNetworks,
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
      }));
    }
  }, [
    currentOverviewOwnerKey,
    isCurrentAllNetworksBalanceFullyReady,
    resolvedBalanceString,
    setLastConfirmedOverviewBalance,
  ]);

  const currentConfirmedBalance =
    lastConfirmedOverviewBalance.byOwner[currentOverviewOwnerKey];
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

    const hasPositiveCurrentOwnerSignal =
      (isCurrentTokenCacheStateMatched &&
        overviewTokenCacheState.hasCache === true) ||
      (isCurrentDeFiDataStateMatched && overviewDeFiDataState.isReady === true);

    if (!hasPositiveCurrentOwnerSignal) {
      return false;
    }

    return !reuseLatestBalanceGraceExpired && !isWalletNotBackedUp;
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

  const displayBalanceString = shouldHoldCurrentConfirmedBalance
    ? currentConfirmedBalance
    : (resolvedBalanceString ??
      currentConfirmedBalance ??
      (canReuseLatestDisplayedBalance
        ? lastConfirmedOverviewBalance.latest
        : undefined));

  const balancePayload = useMemo(
    () => ({
      ownerKey: currentOverviewOwnerKey,
      value: displayBalanceString,
    }),
    [currentOverviewOwnerKey, displayBalanceString],
  );
  const debouncedBalancePayload = useDebounce(balancePayload, 100);

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

  return (
    <YStack gap="$2.5" alignItems="flex-start">
      <YStack w="100%" gap="$2">
        {showSkeleton ? (
          <Skeleton.Heading5Xl my="$-0.5" />
        ) : (
          <XStack alignItems="center" gap="$3">
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
                {renderedBalanceString ?? '0'}
              </NumberSizeableTextWrapper>
            </XStack>
            {refreshButton}
          </XStack>
        )}
      </YStack>
      {vaultSettings?.hasFrozenBalance ? (
        <Button
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
