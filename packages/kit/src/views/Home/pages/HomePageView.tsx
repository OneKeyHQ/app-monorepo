import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { MutableRefObject } from 'react';

import { useFocusEffect } from '@react-navigation/core';
import { CanceledError } from 'axios';
import { useIntl } from 'react-intl';

import type { ITabContainerRef } from '@onekeyhq/components';
import {
  DelayedFreeze,
  HeaderScrollGestureWrapper,
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
  useMedia,
  useScrollContentTabBarOffset,
  useTabsScrollToTop,
  useTheme,
} from '@onekeyhq/components';
import type { ITabBarItemProps } from '@onekeyhq/components/src/composite/Tabs/TabBar';
import { TabBarItem } from '@onekeyhq/components/src/composite/Tabs/TabBar';
import { useTabContainerWidth } from '@onekeyhq/kit/src/hooks/useTabContainerWidth';
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
import {
  EPerpPageEnterSource,
  setPerpPageEnterSource,
} from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import { homeHeaderLayoutCache } from '@onekeyhq/shared/src/storage/uiSnapshotCaches';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useUnifiedNetworkSelectorTrigger } from '../../../components/AccountSelector/hooks/useUnifiedNetworkSelectorTrigger';
import { EmptyAccount, EmptyWallet } from '../../../components/Empty';
import { NetworkAlert } from '../../../components/NetworkAlert';
import { NotificationEnableAlert } from '../../../components/NotificationEnableAlert';
import { NotificationPermissionRecoveryAlert } from '../../../components/NotificationPermissionRecoveryAlert';
import { RiskApprovalAlert } from '../../../components/RiskApprovalAlert';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { WatchOnlyAlert } from '../../../components/WatchOnlyAlert';
import { WebDappEmptyView } from '../../../components/WebDapp/WebDappEmptyView';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { runAfterTokensDone } from '../../../hooks/useRunAfterTokensDone';
import { useShortcutsOnRouteFocused } from '../../../hooks/useShortcutsOnRouteFocused';
import {
  buildOverviewOwnerKey,
  useAccountOverviewActions,
} from '../../../states/jotai/contexts/accountOverview';
import {
  useAccountSelectorStorageInitDoneAtom,
  useActiveAccount,
  useIsAccountSelectorActiveAccountInitDone,
  useIsAccountSelectorSyncLoading,
} from '../../../states/jotai/contexts/accountSelector';
import { deferHeavyWorkUntilUIIdle } from '../../../utils/deferHeavyWork';
import { NetworkUnsupportedWarning } from '../../Staking/components/ProtocolDetails/NetworkUnsupportedWarning';
import { HomeStickyHeaderContext } from '../components/HomeStickyHeaderContext';
import { HomeSupportedWallet } from '../components/HomeSupportedWallet';
import { NotBackedUpEmpty } from '../components/NotBakcedUp';
import { PullToRefresh, onHomePageRefresh } from '../components/PullToRefresh';
import { useHomeWalletTabSupport } from '../hooks/useHomeWalletTabSupport';
import { HomeTestIDs } from '../testIDs';

import { DeFiContainerWithProvider } from './DeFiContainer';
import { HomeHeaderContainer } from './HomeHeaderContainer';
import { homePageContentMaxWidthSx } from './homePageContentMaxWidth';
import {
  isWalletListResolvedNoWallet,
  shouldShowNoWalletContent,
} from './homePageNoWalletContent';
import {
  isHomeTabActive,
  useHomeTabFreeze,
  useHomeTabOwnerThaw,
} from './homeTabFreeze';
import { NFTListContainerWithProvider } from './NFTListContainer';
import { PerpsContainer } from './PerpsContainer';
import { PortfolioContainerWithProvider } from './PortfolioContainer';
import { TabHeaderSettings } from './TabHeaderSettings';
import { TxHistoryListContainerWithProvider } from './TxHistoryContainer';
import WalletContentWithAuth from './WalletContentWithAuth';

import type { LayoutChangeEvent } from 'react-native';

const networksSupportBulkRevokeApproval =
  getNetworksSupportBulkRevokeApproval();
const NATIVE_TAB_BAR_CONTAINER_STYLE = { position: 'relative' } as const;
// Seed for the collapsible header height before the first layout (the funded
// layout with the banner band). Measured heights per header variant are kept
// for the session so a later switch back paints with the exact height.
const NATIVE_HEADER_HEIGHT_SEED = 292;
// Header container height (alerts excluded) per layout variant.
const learnedNativeHeaderHeights = new Map<string, number>();

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

// Placement differs by platform — see the renderHeader comment in HomePageView.
function HomeAlerts() {
  return (
    <>
      <RiskApprovalAlert />
      <WatchOnlyAlert />
      <NetworkAlert />
      <NotificationPermissionRecoveryAlert
        scene="home"
        initialDelayMs={6000}
        showAlert={false}
      />
    </>
  );
}

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

// Tabs.Container mounts all 4 home tabs (Spot, DeFi, NFT, History) as
// peer panes in a horizontal scroller, so React reconciles every block
// on each Wallet unfreeze (or any HomePageView re-render) — including
// the DeFi / NFT / History trees the user is not currently looking at.
// Freezing the inactive panes drops that work back to the focused tab
// only, which is what visibly happens already and matches the
// freeze-on-blur strategy used at the outer tab-navigator level.
//
// Timing matters on native: a frozen pane renders nothing, and the pager
// flips `focusedTab` half-way through its slide. Freezing the outgoing pane
// at that instant blanks it mid-animation, and a target pane that is still
// frozen cannot take the tab view's scroll-offset sync (the header then
// snaps to the wrong collapse state once it thaws). So the pressed target
// thaws on the tab press itself, and blur only freezes after a delay.
//
// `ownerKey` is the account identity the container used to be keyed on. A
// pane that feeds always-visible state (the wallet pane owns the token data
// behind the header worth) passes it so an account switch made from another
// tab thaws it for one commit; see useHomeTabOwnerThaw.
function FreezeInactiveHomeTab({
  tabName,
  pressedTabName,
  ownerKey,
  keepActive,
  children,
}: {
  tabName: string;
  pressedTabName: string;
  ownerKey?: string;
  keepActive: boolean;
  children: React.ReactNode;
}) {
  const focusedTab = useFocusedTab();
  const ownerThaw = useHomeTabOwnerThaw(ownerKey);
  const frozen = useHomeTabFreeze(
    keepActive ||
      ownerThaw ||
      isHomeTabActive({ tabName, focusedTab, pressedTabName }),
  );
  return <DelayedFreeze freeze={frozen}>{children}</DelayedFreeze>;
}

// Tabs.Container no longer remounts on an account switch (OK-63873), so the
// panes keep their scroll offsets across it. The page still wants a switched
// account to start at the top, the way the remount used to leave it. The pane
// refs only exist inside the container, so this bridge, mounted in the
// always-mounted wallet pane, hands the container-scoped scroll-to-top up to
// HomePageView through a ref.
function HomeTabsScrollToTopBridge({
  scrollToTopRef,
}: {
  scrollToTopRef: MutableRefObject<(() => void) | undefined>;
}) {
  const scrollToTop = useTabsScrollToTop();
  useLayoutEffect(() => {
    scrollToTopRef.current = scrollToTop;
    return () => {
      if (scrollToTopRef.current === scrollToTop) {
        scrollToTopRef.current = undefined;
      }
    };
  }, [scrollToTop, scrollToTopRef]);
  return null;
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
  const navigation = useAppNavigation();
  const isTravelModeRuntime =
    travelModeManager.getRuntimeEnvironmentSync().profile.kind ===
    'travel-mode';
  const { md: isSmallScreen } = useMedia();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const {
    account,
    accountName,
    network,
    deriveInfo,
    wallet,
    ready,
    device,
    indexedAccount,
    vaultSettings: cachedVaultSettings,
  } = activeAccount;
  const { showUnifiedNetworkSelector } = useUnifiedNetworkSelectorTrigger({
    num: 0,
  });
  const handleNetworkSelectorShortcut = useCallback(() => {
    if (
      platformEnv.isWebDappMode ||
      accountUtils.hasNoUsableWallet({ wallet, account })
    ) {
      return;
    }
    showUnifiedNetworkSelector({
      recordNetworkHistoryEnabled: true,
      defaultTab:
        network?.isAllNetworks &&
        !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' })
          ? 'portfolio'
          : undefined,
    });
  }, [account, network?.isAllNetworks, showUnifiedNetworkSelector, wallet]);
  useShortcutsOnRouteFocused(
    EShortcutEvents.NetworkSelector,
    handleNetworkSelectorShortcut,
  );
  const [accountSelectorStorageInitDone] =
    useAccountSelectorStorageInitDoneAtom();
  const accountSelectorActiveAccountInitDone =
    useIsAccountSelectorActiveAccountInitDone(0);
  const { result: walletListResult, run: refreshWalletList } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceAccount.getWallets({
        ignoreEmptySingletonWalletAccounts: true,
      }),
    [],
    {
      checkIsFocused: false,
      watchLoading: false,
    },
  );

  const approvalOwnerKey = buildOverviewOwnerKey(account?.id, network?.id);
  const { updateApprovalsInfo } = useAccountOverviewActions().current;
  const tabsRef = useRef<ITabContainerRef | null>(null);
  const homeTabsScrollToTopRef = useRef<(() => void) | undefined>(undefined);
  // Keep the measured native tab bar height outside the tab container
  // so remounts do not briefly reserve the library's default 48pt height.
  const nativeTabBarHeightRef = useRef<number | undefined>(undefined);
  const nativeTabBarContainerStyle = useMemo(
    () => ({
      ...NATIVE_TAB_BAR_CONTAINER_STYLE,
      onLayout: platformEnv.isNative
        ? (event: LayoutChangeEvent) => {
            const height = Math.round(event.nativeEvent.layout.height);
            if (height > 0) {
              nativeTabBarHeightRef.current = height;
            }
          }
        : undefined,
    }),
    [],
  );

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

  const {
    isDeFiSupported: isDeFiEnabled,
    isPerpsSupported: isPerpsEnabled,
    perpTabShowWeb,
  } = useHomeWalletTabSupport({ network });

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
    updateApprovalsInfo({
      ownerKey: approvalOwnerKey,
      hasRiskApprovals: false,
      riskApprovalsCount: 0,
    });

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
          ownerKey: approvalOwnerKey,
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
    approvalOwnerKey,
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
        onCreateAddress={
          network?.isAllNetworks
            ? () =>
                showUnifiedNetworkSelector({
                  recordNetworkHistoryEnabled: true,
                  defaultTab: 'portfolio',
                })
            : undefined
        }
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
    [
      accountName,
      deriveInfo?.label,
      deriveInfo?.labelKey,
      intl,
      network?.isAllNetworks,
      network?.name,
      showUnifiedNetworkSelector,
    ],
  );

  // Web: alerts sit outside Tabs.Container (rendered next to TabPageHeader
  // below). Keeping them inside renderHeader made them scroll through the
  // sticky TabBar area — a partially-scrolled alert would leave a visible band
  // between TabPageHeader and the tabs.
  //
  // Native: alerts live inside the collapsible header instead. Tabs.Container
  // never moves; its header only translates up by its own height, so anything
  // left in normal flow above the container keeps its slot when collapsed, and
  // the header's opaque top container paints over that slot with its own
  // bottom edge (the banner card). That read as "the banner keeps occupying
  // the top" whenever an alert was showing (OK-62183). Inside the header the
  // alerts collapse away with everything else.
  // Native header height hint (OK-63873). The collapsible tab container only
  // learns the header height from onLayout, one or two frames after a layout
  // change, and the tab content padding follows it, so a switch between a
  // funded account (actions + banner band) and an empty one (add-money block)
  // showed the list shifted for those frames. Remember the measured height of
  // the header container per layout variant and hand the tab container the
  // expected total in the same commit the variant changes; onLayout only
  // corrects a wrong hint. The alert band above the container (risk approval,
  // watch-only, network) is measured separately and added live, so accounts
  // with and without alerts never share a remembered height.
  const [nativeHeaderHeightHint, setNativeHeaderHeightHint] = useState(
    NATIVE_HEADER_HEIGHT_SEED,
  );
  const nativeHeaderAlertsHeightRef = useRef(0);
  const handleHeaderAlertsLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.round(event.nativeEvent.layout.height);
    const delta = height - nativeHeaderAlertsHeightRef.current;
    if (delta === 0) {
      return;
    }
    nativeHeaderAlertsHeightRef.current = height;
    // Alerts can change within one header variant, where no variant or
    // container height change re-applies the hint; shift it by the alert
    // delta so it tracks the band regardless of which onLayout lands first.
    setNativeHeaderHeightHint((prev) => prev + delta);
  }, []);
  const handleHeaderVariantChange = useCallback((variant: string) => {
    let learned = learnedNativeHeaderHeights.get(variant);
    if (!learned) {
      // First time this launch: the height measured on an earlier launch.
      try {
        learned = homeHeaderLayoutCache.get(variant)?.data;
      } catch {
        learned = undefined;
      }
      if (learned) {
        learnedNativeHeaderHeights.set(variant, learned);
      }
    }
    if (learned) {
      setNativeHeaderHeightHint(learned + nativeHeaderAlertsHeightRef.current);
    }
  }, []);
  const handleHeaderContainerLayout = useCallback(
    (variant: string, rawHeight: number) => {
      const height = Math.round(rawHeight);
      if (height <= 0) {
        return;
      }
      if (learnedNativeHeaderHeights.get(variant) !== height) {
        learnedNativeHeaderHeights.set(variant, height);
        try {
          homeHeaderLayoutCache.set(variant, height);
        } catch {
          // The hint is a paint optimization; failing to remember it is fine.
        }
      }
      setNativeHeaderHeightHint(height + nativeHeaderAlertsHeightRef.current);
    },
    [],
  );

  const renderHeader = useCallback(() => {
    return (
      <Stack {...homePageContentMaxWidthSx}>
        {platformEnv.isNative ? (
          <Stack onLayout={handleHeaderAlertsLayout}>
            <HeaderScrollGestureWrapper onRefresh={onHomePageRefresh}>
              <HomeAlerts />
            </HeaderScrollGestureWrapper>
          </Stack>
        ) : null}
        <HomeHeaderContainer
          onHeaderVariantChange={
            platformEnv.isNative ? handleHeaderVariantChange : undefined
          }
          onHeaderLayout={
            platformEnv.isNative ? handleHeaderContainerLayout : undefined
          }
        />
      </Stack>
    );
  }, [
    handleHeaderAlertsLayout,
    handleHeaderContainerLayout,
    handleHeaderVariantChange,
  ]);

  // react-native-collapsible-tab-view paints its header container white. In
  // dark mode that white showed through wherever the header content has no
  // opaque background: around and inside the offline banner (NetworkAlert
  // uses margins and translucent critical colors) and at 1px layout seams
  // above the tab bar (OK-63706). Paint the container with the page color.
  const theme = useTheme();
  const headerContainerStyle = useMemo(
    () => ({ backgroundColor: theme.bgApp.val }),
    [theme.bgApp.val],
  );

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

  const accountPaneKey = [
    wallet?.id,
    indexedAccount?.id,
    account?.id,
    network?.id,
    activeAccount.deriveType,
  ].join('|');
  const tabConfigs = useMemo(() => {
    return [
      {
        id: EHomeWalletTab.Portfolio,
        name: intl.formatMessage({
          id: ETranslations.dexmarket_spot,
        }),
        testID: HomeTestIDs.tabPortfolio,
        component: <PortfolioContainerWithProvider />,
      },
      isPerpsEnabled
        ? {
            id: EHomeWalletTab.Perps,
            name: intl.formatMessage({
              id: ETranslations.global_perp,
            }),
            testID: HomeTestIDs.tabPerps,
            component: (
              <HomeTabContentMaxWidth>
                <PerpsContainer />
              </HomeTabContentMaxWidth>
            ),
          }
        : undefined,
      isDeFiEnabled
        ? {
            id: EHomeWalletTab.DeFi,
            name: intl.formatMessage({
              id: ETranslations.global_earn,
            }),
            testID: HomeTestIDs.tabDefi,
            component: <DeFiContainerWithProvider key={accountPaneKey} />,
          }
        : undefined,
      isNFTEnabled
        ? {
            id: EHomeWalletTab.NFT,
            name: intl.formatMessage({
              id: ETranslations.global_nft,
            }),
            testID: HomeTestIDs.tabNFT,
            component: (
              <HomeTabContentMaxWidth>
                <NFTListContainerWithProvider key={accountPaneKey} />
              </HomeTabContentMaxWidth>
            ),
          }
        : undefined,
      {
        id: EHomeWalletTab.History,
        name: intl.formatMessage({
          id: ETranslations.global_history,
        }),
        testID: HomeTestIDs.tabHistory,
        component: (
          <HomeTabContentMaxWidth>
            <TxHistoryListContainerWithProvider key={accountPaneKey} />
          </HomeTabContentMaxWidth>
        ),
      },
    ].filter(Boolean);
  }, [accountPaneKey, intl, isDeFiEnabled, isNFTEnabled, isPerpsEnabled]);

  const pagerTabConfigs = useMemo(
    () =>
      tabConfigs.filter(
        (tab) => !(perpTabShowWeb && tab.id === EHomeWalletTab.Perps),
      ),
    [perpTabShowWeb, tabConfigs],
  );

  const tabBarTabNames = useMemo(
    () => tabConfigs.map((tab) => tab.name),
    [tabConfigs],
  );

  const tabTestIDMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const tab of tabConfigs) {
      if (tab.testID) {
        map[tab.name] = tab.testID;
      }
    }
    return map;
  }, [tabConfigs]);

  const switchToPerpsWebTab = useCallback(() => {
    setPerpPageEnterSource(EPerpPageEnterSource.Home);
    navigation.switchTab(ETabRoutes.WebviewPerpTrade);
  }, [navigation]);

  const handleRenderItem = useCallback(
    (props: ITabBarItemProps) => {
      const testID = tabTestIDMap[props.name];
      const nextTab = tabConfigs.find((tab) => tab.name === props.name);
      const handlePress = (name: string) => {
        if (perpTabShowWeb && nextTab?.id === EHomeWalletTab.Perps) {
          switchToPerpsWebTab();
          return;
        }
        props.onPress(name);
      };
      return <TabBarItem {...props} testID={testID} onPress={handlePress} />;
    },
    [perpTabShowWeb, switchToPerpsWebTab, tabConfigs, tabTestIDMap],
  );

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

  const initialTabName = pagerTabConfigs[0]?.name ?? '';
  const [activeTabName, setActiveTabName] = useState(initialTabName);
  const initialTabId = pagerTabConfigs[0]?.id;
  const [activeTabId, setActiveTabId] = useState<EHomeWalletTab | undefined>(
    initialTabId,
  );
  const [mountedHomeTabIds, setMountedHomeTabIds] = useState<
    Set<EHomeWalletTab>
  >(() => (initialTabId ? new Set([initialTabId]) : new Set()));
  const lastDisplayableTabNameRef = useRef(initialTabName);

  useEffect(() => {
    setActiveTabName((prev) =>
      pagerTabConfigs.some((tab) => tab.name === prev)
        ? prev
        : (pagerTabConfigs[0]?.name ?? ''),
    );
    setActiveTabId((prev) =>
      pagerTabConfigs.some((tab) => tab.id === prev)
        ? prev
        : pagerTabConfigs[0]?.id,
    );
    const lastDisplayableTab = pagerTabConfigs.find(
      (tab) => tab.name === lastDisplayableTabNameRef.current,
    );
    if (!lastDisplayableTab) {
      lastDisplayableTabNameRef.current = pagerTabConfigs[0]?.name ?? '';
    }
  }, [pagerTabConfigs]);

  useEffect(() => {
    if (!perpTabShowWeb || activeTabId !== EHomeWalletTab.Perps) {
      return;
    }
    const fallbackTabName = pagerTabConfigs[0]?.name;
    if (fallbackTabName) {
      tabsRef.current?.jumpToTab(fallbackTabName);
    }
  }, [activeTabId, perpTabShowWeb, pagerTabConfigs]);

  // Tabs.Container is not remounted on a wallet / account switch (OK-63873),
  // so a switch that lands on a network without the focused NFT / DeFi tab
  // only drops that Tabs.Tab. The effect above moves `activeTabName` to the
  // first tab, but neither pager follows on its own: the native pager keeps
  // its index (now another pane), and the web container keeps the removed
  // name (no highlight, stale page offset). Move the pager explicitly.
  useEffect(() => {
    if (pagerTabConfigs.some((tab) => tab.name === activeTabName)) {
      return;
    }
    const fallbackTabName = pagerTabConfigs[0]?.name;
    if (fallbackTabName) {
      tabsRef.current?.jumpToTab(fallbackTabName);
    }
  }, [activeTabName, pagerTabConfigs]);

  useEffect(() => {
    if (!activeTabId) {
      return;
    }
    setMountedHomeTabIds((prev) => {
      if (prev.has(activeTabId)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(activeTabId);
      return next;
    });
  }, [activeTabId]);

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
      // Design: plain-text tabs on small screens only; pill elsewhere.
      const tabBarVariant = isSmallScreen ? 'text' : 'pill';
      const handleTabPress = (name: string) => {
        const nextTab = tabConfigs.find((tab) => tab.name === name);
        if (perpTabShowWeb && nextTab?.id === EHomeWalletTab.Perps) {
          switchToPerpsWebTab();
          return;
        }
        setActiveTabName(nextTab?.name ?? name);
        setActiveTabId(nextTab?.id);
        lastDisplayableTabNameRef.current = nextTab?.name ?? name;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        tabBarProps.onTabPress?.(name);
      };

      if (platformEnv.isNative) {
        return (
          <Tabs.TabBar
            {...tabBarProps}
            containerStyle={nativeTabBarContainerStyle}
            tabNames={tabBarTabNames}
            indexDecimal={perpTabShowWeb ? undefined : tabBarProps.indexDecimal}
            onTabPress={handleTabPress}
            variant={tabBarVariant}
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
              tabNames={tabBarTabNames}
              indexDecimal={
                perpTabShowWeb ? undefined : tabBarProps.indexDecimal
              }
              onTabPress={handleTabPress}
              variant={tabBarVariant}
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
      switchToPerpsWebTab,
      perpTabShowWeb,
      isSmallScreen,
      nativeTabBarContainerStyle,
      tabConfigs,
      tabBarTabNames,
    ],
  );

  const handleTabChange = useCallback(
    (data: { tabName: string }) => {
      const nextTab = tabConfigs.find((tab) => tab.name === data.tabName);
      if (perpTabShowWeb && nextTab?.id === EHomeWalletTab.Perps) {
        switchToPerpsWebTab();
        const fallbackTabName =
          lastDisplayableTabNameRef.current || pagerTabConfigs[0]?.name;
        if (fallbackTabName && fallbackTabName !== data.tabName) {
          tabsRef.current?.jumpToTab(fallbackTabName);
        }
        return;
      }
      setActiveTabName(nextTab?.name ?? data.tabName);
      setActiveTabId(nextTab?.id);
      lastDisplayableTabNameRef.current = nextTab?.name ?? data.tabName;
    },
    [perpTabShowWeb, switchToPerpsWebTab, tabConfigs, pagerTabConfigs],
  );

  // Start a switched account at the top of every pane. This is the same
  // identity the container used to be keyed on (wallet + indexedAccountId,
  // account.id for Others wallets), so a pure network switch keeps its scroll
  // position exactly as before. Layout effect: the reset lands in the same
  // frame as the replayed token list, not one frame after it.
  const homeScrollOwnerKey = `${wallet?.id ?? ''}-${
    account?.indexedAccountId ?? account?.id ?? ''
  }`;
  const prevHomeScrollOwnerKeyRef = useRef(homeScrollOwnerKey);
  useLayoutEffect(() => {
    if (prevHomeScrollOwnerKeyRef.current === homeScrollOwnerKey) {
      return;
    }
    prevHomeScrollOwnerKeyRef.current = homeScrollOwnerKey;
    homeTabsScrollToTopRef.current?.();
  }, [homeScrollOwnerKey]);

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
    // Tabs.Container is deliberately NOT keyed on the wallet / account /
    // network (OK-53686, OK-63873). A remount destroys every pane (the token
    // list, each Token image, TabHeaderSettings) and repaints them from
    // scratch: a 3-row skeleton where the list was, icon skeletons, and the
    // settings icon blinking out — the "home list jitter" on every account
    // switch. All panes already track `account.id` / `network.id` changes
    // through their own hooks (HD wallets change account.id on a network
    // switch, which has run through this no-remount path since #11386), and
    // the token list is re-stamped for the new owner synchronously by the
    // cells producer's per-owner replay, so nothing here needs a fresh mount.
    // isDeFiEnabled/isNFTEnabled stay out for the same reason: tabs render
    // conditionally inside the container instead.
    //
    // The container still remounts when the not-backed-up branch above
    // toggles, which resets the pager to the first tab while HomePageView's
    // activeTab state still points at the previously selected tab, so seed
    // the remounted container with that tab. But the new pagerTabConfigs and
    // the stale activeTabName can land in the same render (the reset effect
    // above runs only after it), and the web Tabs.Container initializes
    // focusedTab with whatever name it receives without falling back when
    // the name is missing from the tab set — leaving content, highlight and
    // active state out of sync. Validate here and fall back to the first tab.
    const seedTabName = pagerTabConfigs.some(
      (tab) => tab.name === activeTabName,
    )
      ? activeTabName
      : pagerTabConfigs[0]?.name;
    return (
      <Tabs.Container
        ref={tabsRef as any}
        // Both implementations only read this prop at mount.
        initialTabName={seedTabName || undefined}
        allowHeaderOverscroll
        disableWebTabContentVisibility
        // The native container applies a changed value before paint (patched
        // react-native-collapsible-tab-view); see nativeHeaderHeightHint.
        headerHeight={platformEnv.isNative ? nativeHeaderHeightHint : undefined}
        tabBarHeight={
          platformEnv.isNative ? nativeTabBarHeightRef.current : undefined
        }
        useNativeHeaderAnimation={platformEnv.isNativeAndroid}
        width={platformEnv.isNative ? (tabContainerWidth as number) : undefined}
        headerContainerStyle={headerContainerStyle}
        renderHeader={renderHeader}
        renderTabBar={renderTabBar}
        onTabChange={handleTabChange}
        renderSubHeader={renderSubHeader}
      >
        {pagerTabConfigs.map((tab) => (
          <Tabs.Tab
            key={tab.name}
            name={tab.name}
            // The native pager mounts a pane only on its first focus, so after
            // an account switch remounts this container with another tab
            // active, nothing would fetch the new owner's tokens and the
            // header (worth, WalletActions, banner) would stay on `unknown`
            // until the user opens the wallet tab (OK-63721). The wallet
            // pane owns that data, so it mounts eagerly (and frozen, see
            // FreezeInactiveHomeTab); other panes keep mounting lazily.
            startMounted={tab.id === EHomeWalletTab.Portfolio}
          >
            {tab.id === EHomeWalletTab.Portfolio ? (
              <HomeTabsScrollToTopBridge
                scrollToTopRef={homeTabsScrollToTopRef}
              />
            ) : null}
            <FreezeInactiveHomeTab
              tabName={tab.name}
              pressedTabName={activeTabName}
              // Portfolio owns the shared header's token requests, including
              // All Networks; it must observe owner changes while off-tab.
              keepActive={tab.id === EHomeWalletTab.Portfolio}
              ownerKey={
                tab.id === EHomeWalletTab.Portfolio
                  ? homeScrollOwnerKey
                  : undefined
              }
            >
              {platformEnv.isNative ||
              tab.id === EHomeWalletTab.Portfolio ||
              tab.id === EHomeWalletTab.Perps ||
              activeTabId === tab.id ||
              mountedHomeTabIds.has(tab.id) ? (
                tab.component
              ) : (
                <Stack flex={1} />
              )}
            </FreezeInactiveHomeTab>
          </Tabs.Tab>
        ))}
      </Tabs.Container>
    );
  }, [
    tabBarHeight,
    tabContainerWidth,
    isWalletNotBackedUp,
    headerContainerStyle,
    renderHeader,
    renderTabBar,
    handleTabChange,
    renderSubHeader,
    pagerTabConfigs,
    activeTabName,
    activeTabId,
    mountedHomeTabIds,
    homeScrollOwnerKey,
    nativeHeaderHeightHint,
  ]);

  const handleSwitchWalletHomeTab = useCallback(
    (payload: { id: EHomeWalletTab }) => {
      if (perpTabShowWeb && payload.id === EHomeWalletTab.Perps) {
        switchToPerpsWebTab();
        return;
      }
      const nextTab = tabConfigs.find((i) => i.id === payload.id);
      if (nextTab) {
        // Same press-ahead update as the tab bar: the target pane must thaw
        // before the pager starts sliding towards it (see
        // FreezeInactiveHomeTab).
        setActiveTabName(nextTab.name);
        setActiveTabId(nextTab.id);
        lastDisplayableTabNameRef.current = nextTab.name;
        tabsRef.current?.jumpToTab(nextTab.name);
      }
    },
    [perpTabShowWeb, switchToPerpsWebTab, tabConfigs],
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
    // Keep the no-wallet gate's wallet list fresh: it feeds
    // shouldShowNoWalletContent, and a stale mount-time list can hold Home on
    // the blank fallback after wallets are removed while mounted.
    const refreshWalletListForNoWalletGate = () => {
      void refreshWalletList();
    };

    appEventBus.on(EAppEventBusNames.WalletUpdate, clearCache);
    appEventBus.on(EAppEventBusNames.AccountUpdate, clearCache);
    appEventBus.on(EAppEventBusNames.AddressBookUpdate, clearCache);
    appEventBus.on(
      EAppEventBusNames.WalletUpdate,
      refreshWalletListForNoWalletGate,
    );
    appEventBus.on(
      EAppEventBusNames.AccountUpdate,
      refreshWalletListForNoWalletGate,
    );
    appEventBus.on(
      EAppEventBusNames.AccountRemove,
      refreshWalletListForNoWalletGate,
    );
    appEventBus.on(
      EAppEventBusNames.SwitchWalletHomeTab,
      handleSwitchWalletHomeTab,
    );
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, clearCache);
      appEventBus.off(EAppEventBusNames.AccountUpdate, clearCache);
      appEventBus.off(EAppEventBusNames.AddressBookUpdate, clearCache);
      appEventBus.off(
        EAppEventBusNames.WalletUpdate,
        refreshWalletListForNoWalletGate,
      );
      appEventBus.off(
        EAppEventBusNames.AccountUpdate,
        refreshWalletListForNoWalletGate,
      );
      appEventBus.off(
        EAppEventBusNames.AccountRemove,
        refreshWalletListForNoWalletGate,
      );
      appEventBus.off(
        EAppEventBusNames.SwitchWalletHomeTab,
        handleSwitchWalletHomeTab,
      );
    };
  }, [handleSwitchWalletHomeTab, refreshWalletList]);

  const { result: accountNetworkNotSupported } = usePromiseResult(
    async () => {
      if (!network?.id || (!wallet?.id && !account?.id)) return undefined;
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
      (network?.isAllNetworks ||
        !(
          vaultSettings?.mergeDeriveAssetsEnabled &&
          networkAccounts &&
          networkAccounts.networkAccounts &&
          networkAccounts.networkAccounts.length > 0
        ))
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
    network?.isAllNetworks,
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
  const walletListWalletIds = walletListResult?.wallets.map((item) => item.id);
  const walletListResolvedNoWallet = isWalletListResolvedNoWallet({
    wallets: walletListResult?.wallets,
  });
  const walletPageContent = useMemo(
    () =>
      platformEnv.isNative ? (
        <AndroidScrollContainer>{homePageContent}</AndroidScrollContainer>
      ) : (
        homePageContent
      ),
    [homePageContent],
  );
  const activeWalletId = wallet?.id;
  const activeWalletUnavailable =
    accountUtils.isWalletDeprecatedOrMocked(wallet);
  const showNoWalletContent = shouldShowNoWalletContent({
    forceNoWalletContent: isTravelModeRuntime,
    hasNoUsableWallet,
    accountSelectorStorageInitDone,
    accountSelectorActiveAccountInitDone,
    walletListResolvedNoWallet,
    activeWalletUnavailable,
    activeWalletId,
    walletListWalletIds,
  });

  const homePage = useMemo(() => {
    if (!ready && !isTravelModeRuntime) {
      return <TabPageHeader sceneName={sceneName} tabRoute={ETabRoutes.Home} />;
    }

    let content = <Stack flex={1} />;

    if (showNoWalletContent) {
      content = <NoWalletContent tabBarHeight={tabBarHeight} />;
    }

    if (!hasNoUsableWallet) {
      content = walletPageContent;
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
            {/* Native keeps the alerts inside the collapsible header (see
                renderHeader), but that header only mounts with the wallet
                content. Without a usable wallet fall back to the outer slot
                so the offline and notification-permission alerts still run. */}
            {platformEnv.isNative && !hasNoUsableWallet ? null : (
              <Stack {...homePageContentMaxWidthSx}>
                <HomeAlerts />
              </Stack>
            )}
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
    isTravelModeRuntime,
    hasNoUsableWallet,
    showNoWalletContent,
    tabPageHeight,
    sceneName,
    handleTabPageLayout,
    walletPageContent,
    tabBarHeight,
  ]);

  return useMemo(() => {
    return (
      <HomeStickyHeaderContext.Provider value={stickyHeaderCtx}>
        <Page fullPage testID={HomeTestIDs.page}>
          {homePage}
        </Page>
      </HomeStickyHeaderContext.Provider>
    );
  }, [homePage, stickyHeaderCtx]);
}
