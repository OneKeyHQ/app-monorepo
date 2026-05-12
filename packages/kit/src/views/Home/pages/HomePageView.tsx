import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/core';
import { CanceledError } from 'axios';
import { useIntl } from 'react-intl';

import type { ITabContainerRef } from '@onekeyhq/components';
import {
  Icon,
  KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET,
  Keyboard,
  Page,
  ScrollView,
  Spinner,
  Stack,
  Tabs,
  XStack,
  YStack,
  useFocusedTab,
  useScrollContentTabBarOffset,
  useTabContainerWidth,
} from '@onekeyhq/components';
import type { ITabBarItemProps } from '@onekeyhq/components/src/composite/Tabs/TabBar';
import { TabBarItem } from '@onekeyhq/components/src/composite/Tabs/TabBar';
import { getNetworksSupportBulkRevokeApproval } from '@onekeyhq/shared/src/config/presetNetworks';
import {
  WALLET_TYPE_HD,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { EmptyAccount, EmptyWallet } from '../../../components/Empty';
import { NetworkAlert } from '../../../components/NetworkAlert';
import { NotificationEnableAlert } from '../../../components/NotificationEnableAlert';
import { RiskApprovalAlert } from '../../../components/RiskApprovalAlert';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { WatchOnlyAlert } from '../../../components/WatchOnlyAlert';
import { WebDappEmptyView } from '../../../components/WebDapp/WebDappEmptyView';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { runAfterTokensDone } from '../../../hooks/useRunAfterTokensDone';
import {
  useAccountOverviewActions,
  useApprovalsInfoAtom,
} from '../../../states/jotai/contexts/accountOverview';
import {
  useActiveAccount,
  useIsAccountSelectorSyncLoading,
} from '../../../states/jotai/contexts/accountSelector';
import { deferHeavyWorkUntilUIIdle } from '../../../utils/deferHeavyWork';
import { NetworkUnsupportedWarning } from '../../Staking/components/ProtocolDetails/NetworkUnsupportedWarning';
import { HomeStickyHeaderContext } from '../components/HomeStickyHeaderContext';
import { HomeSupportedWallet } from '../components/HomeSupportedWallet';
import { NotBackedUpEmpty } from '../components/NotBakcedUp';
import { PullToRefresh, onHomePageRefresh } from '../components/PullToRefresh';

import { DeFiContainerWithProvider } from './DeFiContainer';
import { HomeHeaderContainer } from './HomeHeaderContainer';
import { homePageContentMaxWidthSx } from './homePageContentMaxWidth';
import { NFTListContainerWithProvider } from './NFTListContainer';
import { PortfolioContainerWithProvider } from './PortfolioContainer';
import { TabHeaderSettings } from './TabHeaderSettings';
import { TxHistoryListContainerWithProvider } from './TxHistoryContainer';
import WalletContentWithAuth from './WalletContentWithAuth';

import type { LayoutChangeEvent } from 'react-native';

const networksSupportBulkRevokeApproval =
  getNetworksSupportBulkRevokeApproval();

interface IAndroidScrollContainerProps {
  children: React.ReactNode;
}
const AndroidScrollContainer = platformEnv.isNativeAndroid
  ? ({ children }: IAndroidScrollContainerProps) => {
      const [height, setHeight] = useState(0);
      const heightRef = useRef(0);
      const handleLayout = useCallback((event: LayoutChangeEvent) => {
        const h = Math.round(event.nativeEvent.layout.height);
        if (h !== heightRef.current) {
          heightRef.current = h;
          setHeight(h);
        }
      }, []);
      const contentContainerStyle = useMemo(() => ({ height }), [height]);
      return (
        <YStack flex={1} onLayout={handleLayout}>
          {height > 0 ? (
            <ScrollView
              nestedScrollEnabled
              refreshControl={<PullToRefresh onRefresh={onHomePageRefresh} />}
              contentContainerStyle={contentContainerStyle}
            >
              {children}
            </ScrollView>
          ) : null}
        </YStack>
      );
    }
  : ({ children }: IAndroidScrollContainerProps) => {
      return children;
    };

function HistoryTabNotificationAlertSlot() {
  const intl = useIntl();
  const focusedTab = useFocusedTab();
  const historyTabName = intl.formatMessage({
    id: ETranslations.global_history,
  });
  if (focusedTab !== historyTabName) {
    return null;
  }
  return <NotificationEnableAlert scene="txHistory" />;
}

function NoWalletContent({ tabBarHeight = 0 }: { tabBarHeight?: number }) {
  const isSyncLoading = useIsAccountSelectorSyncLoading(0);
  if (isSyncLoading) {
    return (
      <Stack flex={1} justifyContent="center" alignItems="center">
        <Spinner size="large" />
      </Stack>
    );
  }
  return (
    <ScrollView
      h="100%"
      contentContainerStyle={{
        justifyContent: 'center',
        flexGrow: 1,
        pb: tabBarHeight,
      }}
    >
      {platformEnv.isWebDappMode ? <WebDappEmptyView /> : <EmptyWallet />}
    </ScrollView>
  );
}

function HomeTabContentMaxWidth({ children }: { children: React.ReactNode }) {
  return (
    <Stack flex={1} {...homePageContentMaxWidthSx}>
      {children}
    </Stack>
  );
}

export function HomePageView({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onPressHide,
  sceneName,
}: {
  onPressHide?: () => void;
  sceneName: EAccountSelectorSceneName;
}) {
  const tabBarHeight = useScrollContentTabBarOffset();
  const tabContainerWidth = useTabContainerWidth();
  const intl = useIntl();
  const {
    activeAccount: {
      account,
      accountName,
      network,
      deriveInfo,
      wallet,
      ready,
      device,
      indexedAccount,
      vaultSettings: cachedVaultSettings,
    },
  } = useActiveAccount({ num: 0 });

  const [{ hasRiskApprovals }] = useApprovalsInfoAtom();
  const { updateApprovalsInfo } = useAccountOverviewActions().current;
  const tabsRef = useRef<ITabContainerRef | null>(null);

  // Force PagerView to re-sync after bottom tab switch (freeze/unfreeze)
  const wasBlurredRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let idleHandle: ReturnType<typeof requestIdleCallback> | undefined;
      if (wasBlurredRef.current && tabsRef.current) {
        // Force PagerView to display the correct page after freeze/unfreeze.
        // Defer until JS thread is idle to avoid blocking the first render
        // frame after tab switch, which causes black screen flicker.
        idleHandle = requestIdleCallback(() => {
          tabsRef.current?.syncCurrentPage();
        });
      }
      return () => {
        if (idleHandle !== undefined) {
          cancelIdleCallback(idleHandle);
        }
        wasBlurredRef.current = true;
      };
    }, []),
  );

  const hasRiskApprovalsRef = useRef(hasRiskApprovals);
  useEffect(() => {
    hasRiskApprovalsRef.current = hasRiskApprovals;
  }, [hasRiskApprovals]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const addressType = deriveInfo?.labelKey
    ? intl.formatMessage({
        id: deriveInfo?.labelKey,
      })
    : (deriveInfo?.label ?? '');

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isHide, setIsHide] = useState(false);

  const result = usePromiseResult(async () => {
    if (!network) {
      return;
    }
    const [v, a] = await Promise.all([
      backgroundApiProxy.serviceNetwork.getVaultSettings({
        networkId: network?.id ?? '',
      }),
      indexedAccount
        ? backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
            {
              networkId: network?.id ?? '',
              indexedAccountId: indexedAccount?.id ?? '',
              excludeEmptyAccount: true,
            },
          )
        : undefined,
    ]);
    return {
      vaultSettings: v,
      networkAccounts: a,
    };
  }, [network, indexedAccount]);

  const { vaultSettings: fetchedVaultSettings, networkAccounts } =
    result.result ?? {};
  // Use cached vaultSettings from activeAccountsAtom (coldStartCache) as
  // fallback to avoid tab config change on first render.
  const vaultSettings = fetchedVaultSettings ?? cachedVaultSettings;

  const isNFTEnabled =
    // All Networks always supports NFT; for single network check vaultSettings
    network?.isAllNetworks ||
    (vaultSettings?.NFTEnabled &&
      networkUtils.getEnabledNFTNetworkIds().includes(network?.id ?? ''));

  const { result: isDeFiEnabled = true } = usePromiseResult(
    async () => {
      if (!network?.id) return false;
      if (networkUtils.isAllNetwork({ networkId: network.id })) return true;
      const enabledNetworks =
        await backgroundApiProxy.serviceDeFi.getDeFiEnabledNetworksMap();
      return !!enabledNetworks[network.id];
    },
    [network?.id],
    {
      initResult: true,
      swrKey: network?.id ? swrKeys.defiEnabled(network.id) : undefined,
    },
  );

  // DEBUG: trace tab config state changes
  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { NativeLogger: NL, LogLevel: LL } =
        require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
      const key = `${account?.id ?? ''}-${account?.indexedAccountId ?? ''}-${network?.id ?? ''}-${isDeFiEnabled ? '1' : '0'}-${isNFTEnabled ? '1' : '0'}`;
      NL.write(
        LL.Info,
        `[LayoutDiag] HomePageView: ready=${ready}, isDeFi=${isDeFiEnabled}, isNFT=${isNFTEnabled}, ` +
          `cachedVS=${!!cachedVaultSettings}, fetchedVS=${!!fetchedVaultSettings}, ` +
          `networkId=${network?.id?.slice(-10) ?? 'nil'}, key=${key}`,
      );
    } catch {
      /* */
    }
  }, [
    ready,
    isDeFiEnabled,
    isNFTEnabled,
    cachedVaultSettings,
    fetchedVaultSettings,
    network?.id,
    account?.id,
    account?.indexedAccountId,
  ]);

  const isWalletNotBackedUp = useMemo(() => {
    if (wallet && wallet.type === WALLET_TYPE_HD && !wallet.backuped) {
      return true;
    }
    return false;
  }, [wallet]);

  const isBulkRevokeApprovalEnabled = useMemo(() => {
    if (wallet?.type === WALLET_TYPE_WATCHING) {
      return false;
    }

    if (network?.isAllNetworks) {
      if (
        accountUtils.isOthersAccount({
          accountId: account?.id ?? '',
        })
      ) {
        return networkUtils.isEvmNetwork({
          networkId: account?.createAtNetwork ?? '',
        });
      }
      return true;
    }

    return networksSupportBulkRevokeApproval[network?.id ?? ''] ?? false;
  }, [
    wallet?.type,
    network?.isAllNetworks,
    network?.id,
    account?.id,
    account?.createAtNetwork,
  ]);

  useEffect(() => {
    let cancelled = false;

    // Keep the red-dot state from becoming stale across account/network switches.
    if (hasRiskApprovalsRef.current) {
      updateApprovalsInfo({ hasRiskApprovals: false, riskApprovalsCount: 0 });
    }

    const run = async (_trigger: string) => {
      if (!isBulkRevokeApprovalEnabled) return;
      if (!account?.id || !network?.id) return;

      await deferHeavyWorkUntilUIIdle();
      if (cancelled) return;

      try {
        const resp =
          await backgroundApiProxy.serviceApproval.fetchAccountApprovals({
            networkId: network.id,
            accountId: account.id,
            indexedAccountId: indexedAccount?.id,
            accountAddress: account.address,
          });
        if (cancelled) return;
        const riskApprovals = resp.contractApprovals.filter(
          (i) => i.isRiskContract,
        );
        updateApprovalsInfo({
          hasRiskApprovals: riskApprovals.length > 0,
          riskApprovalsCount: riskApprovals.length,
        });
      } catch (error) {
        if (error instanceof CanceledError) {
          return;
        }
        console.error(error);
      }
    };

    const cleanup = runAfterTokensDone({
      enabled: isBulkRevokeApprovalEnabled,
      fallbackDelayMs: 12_000,
      deferWhileRefreshing: true,
      retryDelayMs: 2000,
      maxWaitMs: 30_000,
      networkId: network?.id,
      matchNetworkId: true,
      onRun: run,
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [
    account?.address,
    account?.id,
    indexedAccount?.id,
    isBulkRevokeApprovalEnabled,
    network?.id,
    updateApprovalsInfo,
  ]);

  const isRequiredValidation = vaultSettings?.validationRequired;
  const softwareAccountDisabled = vaultSettings?.softwareAccountDisabled;
  const supportedDeviceTypes = vaultSettings?.supportedDeviceTypes;
  const watchingAccountEnabled = vaultSettings?.watchingAccountEnabled;

  const emptyAccountView = useMemo(
    () => (
      <EmptyAccount
        autoCreateAddress
        createAllDeriveTypes
        createAllEnabledNetworks
        name={accountName}
        chain={network?.name ?? ''}
        type={
          (deriveInfo?.labelKey
            ? intl.formatMessage({
                id: deriveInfo?.labelKey,
              })
            : deriveInfo?.label) ?? ''
        }
      />
    ),
    [accountName, deriveInfo?.label, deriveInfo?.labelKey, intl, network?.name],
  );

  // Alerts sit outside Tabs.Container (rendered next to TabPageHeader below).
  // Keeping them inside renderHeader made them scroll through the sticky
  // TabBar area — a partially-scrolled alert would leave a visible band
  // between TabPageHeader and the tabs.
  const renderHeader = useCallback(() => {
    return (
      <Stack {...homePageContentMaxWidthSx}>
        <HomeHeaderContainer />
      </Stack>
    );
  }, []);

  // Rendered on web only. On native the equivalent lives inside the history
  // list's ListHeaderComponent so its height stays inside the list's measurer.
  const renderSubHeader = useCallback(
    () => (
      <Stack {...homePageContentMaxWidthSx}>
        <HistoryTabNotificationAlertSlot />
      </Stack>
    ),
    [],
  );

  const tabConfigs = useMemo(() => {
    return [
      {
        id: EHomeWalletTab.Portfolio,
        name: intl.formatMessage({
          id: ETranslations.dexmarket_spot,
        }),
        component: <PortfolioContainerWithProvider />,
      },
      isDeFiEnabled
        ? {
            id: EHomeWalletTab.DeFi,
            name: intl.formatMessage({
              id: ETranslations.global_earn,
            }),
            component: <DeFiContainerWithProvider />,
          }
        : undefined,
      isNFTEnabled
        ? {
            id: EHomeWalletTab.NFT,
            name: intl.formatMessage({
              id: ETranslations.global_nft,
            }),
            component: (
              <HomeTabContentMaxWidth>
                <NFTListContainerWithProvider />
              </HomeTabContentMaxWidth>
            ),
          }
        : undefined,
      {
        id: EHomeWalletTab.History,
        name: intl.formatMessage({
          id: ETranslations.global_history,
        }),
        component: (
          <HomeTabContentMaxWidth>
            <TxHistoryListContainerWithProvider />
          </HomeTabContentMaxWidth>
        ),
      },
    ].filter(Boolean);
  }, [intl, isDeFiEnabled, isNFTEnabled]);

  const handleRenderItem = useCallback((props: ITabBarItemProps) => {
    return <TabBarItem {...props} />;
  }, []);

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const portalRefCallback = useCallback((el: HTMLDivElement | null) => {
    setPortalTarget((prev) => (prev === el ? prev : el));
  }, []);

  const [stickyHost, setStickyHost] = useState<HTMLElement | null>(null);
  const stickyHostRefCallback = useCallback((el: unknown) => {
    const next =
      typeof HTMLElement !== 'undefined' && el instanceof HTMLElement
        ? el
        : null;
    setStickyHost((prev) => (prev === next ? prev : next));
  }, []);

  const initialTabName = tabConfigs[0]?.name ?? '';
  const [activeTabName, setActiveTabName] = useState(initialTabName);
  const initialTabId = tabConfigs[0]?.id;
  const [activeTabId, setActiveTabId] = useState<EHomeWalletTab | undefined>(
    initialTabId,
  );

  useEffect(() => {
    setActiveTabName((prev) =>
      tabConfigs.some((tab) => tab.name === prev)
        ? prev
        : (tabConfigs[0]?.name ?? ''),
    );
    setActiveTabId((prev) =>
      tabConfigs.some((tab) => tab.id === prev) ? prev : tabConfigs[0]?.id,
    );
  }, [tabConfigs]);

  const renderToolbar = useCallback(
    ({ focusedTab }: { focusedTab: string }) => (
      <XStack alignItems="center" gap="$3" flexShrink={0}>
        <TabHeaderSettings focusedTab={focusedTab} />
      </XStack>
    ),
    [],
  );

  const renderTabBar = useCallback(
    (tabBarProps: any) => {
      const handleTabPress = (name: string) => {
        const nextTab = tabConfigs.find((tab) => tab.name === name);
        setActiveTabName(nextTab?.name ?? name);
        setActiveTabId(nextTab?.id);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        tabBarProps.onTabPress?.(name);
      };

      if (platformEnv.isNative) {
        return (
          <Tabs.TabBar
            {...tabBarProps}
            onTabPress={handleTabPress}
            variant="pill"
            renderItem={handleRenderItem}
            renderToolbar={renderToolbar}
          />
        );
      }

      // Outer YStack stays full-width so the sticky bg covers the entire
      // viewport when the user scrolls the tab bar to the top. The inner Stack
      // applies the centered max-width so the actual TabBar pills line up with
      // the rest of the page content blocks.
      return (
        <YStack
          ref={stickyHostRefCallback as any}
          bg="$bgApp"
          position={'sticky' as any}
          top={0}
          zIndex={10}
        >
          <Stack {...homePageContentMaxWidthSx}>
            <Tabs.TabBar
              {...tabBarProps}
              onTabPress={handleTabPress}
              variant="pill"
              renderItem={handleRenderItem}
              renderToolbar={renderToolbar}
              containerStyle={{ position: 'relative' as any }}
            />
            <div
              ref={portalRefCallback}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 1,
              }}
            />
          </Stack>
        </YStack>
      );
    },
    [
      portalRefCallback,
      stickyHostRefCallback,
      handleRenderItem,
      renderToolbar,
      tabConfigs,
    ],
  );

  const handleTabChange = useCallback(
    (data: { tabName: string }) => {
      const nextTab = tabConfigs.find((tab) => tab.name === data.tabName);
      setActiveTabName(nextTab?.name ?? data.tabName);
      setActiveTabId(nextTab?.id);
    },
    [tabConfigs],
  );

  const stickyHeaderCtx = useMemo(
    () => ({
      portalTarget,
      stickyHost,
      activeTabName,
      activeTabId,
    }),
    [portalTarget, stickyHost, activeTabName, activeTabId],
  );

  const tabs = useMemo(() => {
    if (isWalletNotBackedUp) {
      return (
        <Keyboard.AwareScrollView
          style={{ flex: 1 }}
          nestedScrollEnabled={platformEnv.isNativeAndroid}
          contentContainerStyle={{ paddingBottom: tabBarHeight }}
          bottomOffset={KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET}
        >
          {renderHeader()}
          <NotBackedUpEmpty />
        </Keyboard.AwareScrollView>
      );
    }
    // Exclude isDeFiEnabled/isNFTEnabled from key to prevent Tabs.Container
    // from being destroyed and recreated when these values change async.
    // Tabs render conditionally inside the container instead.
    //
    // Also exclude `account?.id` and `network?.id`: for HD wallets the
    // per-network account.id differs across networks even when the user is
    // on the same indexedAccount, and including network.id forces a full
    // remount of Tabs.Container (and the FlashList inside TokenListView) on
    // every network switch. The remount produces a brief blank frame while
    // FlashList re-measures, even when the target has cache. Keying on
    // wallet + indexedAccountId (with account.id as the Others-wallet
    // fallback, since those have no indexedAccountId) keeps the subtree
    // mounted across pure network switches — the singleton token-list atoms
    // are then driven by account/network changes via the per-owner cache
    // hydration in TokenListBlock.
    //
    // Caveat: Others wallets (imported / watching / external) have no
    // `indexedAccountId`, so they fall back to `account.id`, which IS
    // network-scoped for those wallet types. Switching networks on an
    // Others wallet therefore still remounts Tabs.Container — the
    // optimization here is intentionally HD-only because Others wallets
    // typically stay pinned to a single network and the cost of the
    // occasional remount is not worth special-casing.
    const key = `${wallet?.id ?? ''}-${
      account?.indexedAccountId ?? account?.id ?? ''
    }`;
    return (
      <Tabs.Container
        ref={tabsRef as any}
        key={key}
        allowHeaderOverscroll
        headerHeight={platformEnv.isNative ? 312 : undefined}
        useNativeHeaderAnimation={platformEnv.isNativeAndroid}
        width={platformEnv.isNative ? (tabContainerWidth as number) : undefined}
        renderHeader={renderHeader}
        renderTabBar={renderTabBar}
        onTabChange={handleTabChange}
        renderSubHeader={renderSubHeader}
      >
        {tabConfigs.map((tab) => (
          <Tabs.Tab key={tab.name} name={tab.name}>
            {tab.component}
          </Tabs.Tab>
        ))}
      </Tabs.Container>
    );
  }, [
    tabBarHeight,
    tabContainerWidth,
    wallet?.id,
    account?.id,
    account?.indexedAccountId,
    isWalletNotBackedUp,
    renderHeader,
    renderTabBar,
    handleTabChange,
    renderSubHeader,
    tabConfigs,
  ]);

  const handleSwitchWalletHomeTab = useCallback(
    (payload: { id: EHomeWalletTab }) => {
      const name = tabConfigs.find((i) => i.id === payload.id)?.name;
      if (name) {
        tabsRef.current?.jumpToTab(name);
      }
    },
    [tabConfigs],
  );

  useEffect(() => {
    void Icon.prefetch(
      'CloudOffOutline',
      'ArrowTopOutline',
      'ArrowBottomOutline',
      'DotHorOutline',
      'SearchOutline',
      'BellOutline',
    );
  }, []);

  useEffect(() => {
    const clearCache = async () => {
      await backgroundApiProxy.serviceAccount.clearAccountNameFromAddressCache();
    };

    appEventBus.on(EAppEventBusNames.WalletUpdate, clearCache);
    appEventBus.on(EAppEventBusNames.AccountUpdate, clearCache);
    appEventBus.on(EAppEventBusNames.AddressBookUpdate, clearCache);
    appEventBus.on(
      EAppEventBusNames.SwitchWalletHomeTab,
      handleSwitchWalletHomeTab,
    );
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, clearCache);
      appEventBus.off(EAppEventBusNames.AccountUpdate, clearCache);
      appEventBus.off(EAppEventBusNames.AddressBookUpdate, clearCache);
      appEventBus.off(
        EAppEventBusNames.SwitchWalletHomeTab,
        handleSwitchWalletHomeTab,
      );
    };
  }, [handleSwitchWalletHomeTab]);

  const { result: accountNetworkNotSupported } = usePromiseResult(
    async () => {
      if (!network?.id) return undefined;
      const checkResult =
        await backgroundApiProxy.serviceAccount.checkAccountNetworkNotSupported(
          {
            walletId: wallet?.id,
            accountId: account?.id,
            accountImpl: account?.impl,
            activeNetworkId: network.id,
            featuresInfoCache: device?.featuresInfo,
          },
        );

      return !!checkResult?.networkImpl;
    },
    [account?.id, account?.impl, wallet?.id, network?.id, device?.featuresInfo],
    { initResult: undefined },
  );

  const homePageContent = useMemo(() => {
    if (accountNetworkNotSupported) {
      return (
        <YStack height="100%">
          <Stack flex={1} justifyContent="center">
            <NetworkUnsupportedWarning
              networkId={network?.id ?? ''}
              emptyStyle
            />
          </Stack>
        </YStack>
      );
    }

    if (
      (softwareAccountDisabled &&
        accountUtils.isHdWallet({
          walletId: wallet?.id ?? '',
        })) ||
      (supportedDeviceTypes &&
        device?.deviceType &&
        !supportedDeviceTypes.includes(device?.deviceType))
    ) {
      return (
        <HomeSupportedWallet
          supportedDeviceTypes={supportedDeviceTypes}
          watchingAccountEnabled={watchingAccountEnabled}
        />
      );
    }

    if (
      !account &&
      !(
        vaultSettings?.mergeDeriveAssetsEnabled &&
        networkAccounts &&
        networkAccounts.networkAccounts &&
        networkAccounts.networkAccounts.length > 0
      )
    ) {
      return (
        <YStack flex={1}>
          <Stack flex={1} justifyContent="center">
            {emptyAccountView}
          </Stack>
        </YStack>
      );
    }

    if (isRequiredValidation) {
      return (
        <WalletContentWithAuth
          networkId={network?.id ?? ''}
          accountId={account?.id ?? ''}
        >
          <>{tabs}</>
        </WalletContentWithAuth>
      );
    }

    return tabs;
  }, [
    accountNetworkNotSupported,
    softwareAccountDisabled,
    wallet?.id,
    supportedDeviceTypes,
    device?.deviceType,
    account,
    vaultSettings?.mergeDeriveAssetsEnabled,
    networkAccounts,
    isRequiredValidation,
    watchingAccountEnabled,
    emptyAccountView,
    network?.id,
    tabs,
  ]);

  // Initial heights based on measured header sizes on each platform.
  // iOS measured: 162 (raw 182 - 20 offset). Must match actual layout
  // to prevent content shift when onLayout fires.
  const [tabPageHeight, setTabPageHeight] = useState(
    platformEnv.isNativeIOS ? 162 : 92,
  );
  const handleTabPageLayout = useCallback((e: LayoutChangeEvent) => {
    const height = e.nativeEvent.layout.height - 20;
    setTabPageHeight(height);
  }, []);

  const hasNoUsableWallet = accountUtils.hasNoUsableWallet({
    wallet,
    account,
  });

  const homePage = useMemo(() => {
    if (!ready) {
      return <TabPageHeader sceneName={sceneName} tabRoute={ETabRoutes.Home} />;
    }

    let content = <NoWalletContent tabBarHeight={tabBarHeight} />;

    if (!hasNoUsableWallet) {
      content = platformEnv.isNative ? (
        <AndroidScrollContainer>{homePageContent}</AndroidScrollContainer>
      ) : (
        homePageContent
      );
      // This is a temporary hack solution, need to fix the layout of headerLeft and headerRight
    }
    return (
      <>
        <Page.Body>
          <Page.Container flex={1} padded={false}>
            {platformEnv.isNative ? (
              <Stack h={tabPageHeight} />
            ) : (
              <TabPageHeader sceneName={sceneName} tabRoute={ETabRoutes.Home} />
            )}
            <Stack {...homePageContentMaxWidthSx}>
              <RiskApprovalAlert />
              <WatchOnlyAlert />
              <NetworkAlert />
            </Stack>
            {content}
            {platformEnv.isNative ? (
              <YStack
                position="absolute"
                top={-20}
                left={0}
                bg="$bgApp"
                pt="$5"
                width="100%"
                onLayout={handleTabPageLayout}
              >
                <TabPageHeader
                  sceneName={sceneName}
                  tabRoute={ETabRoutes.Home}
                />
              </YStack>
            ) : null}
          </Page.Container>
        </Page.Body>
      </>
    );
  }, [
    ready,
    hasNoUsableWallet,
    tabPageHeight,
    sceneName,
    handleTabPageLayout,
    homePageContent,
    tabBarHeight,
  ]);

  return useMemo(() => {
    return (
      <HomeStickyHeaderContext.Provider value={stickyHeaderCtx}>
        <Page fullPage>{homePage}</Page>
      </HomeStickyHeaderContext.Provider>
    );
  }, [homePage, stickyHeaderCtx]);
}
