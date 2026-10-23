import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import * as ExpoDevice from 'expo-device';
import { Freeze } from 'react-freeze';
import { BackHandler, StyleSheet, View } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';

import {
  Page,
  Stack,
  YStack,
  isLiquidGlassAvailable,
  rootNavigationRef,
  useIsSplitView,
  useSafeAreaInsets,
  useSplitMainView,
  useSplitSubView,
} from '@onekeyhq/components';
import type { ITabContainerRef } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { LazyPageContainer } from '@onekeyhq/kit/src/components/LazyPageContainer';
import { TabletHomeContainer } from '@onekeyhq/kit/src/components/TabletHomeContainer';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { LegacyUniversalSearchInput } from '@onekeyhq/kit/src/components/TabPageHeader/LegacyUniversalSearchInput';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { useTakeScreenshot } from '@onekeyhq/kit/src/views/Discovery/hooks/useTakeScreenshot';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { isDualScreenDevice } from '@onekeyhq/shared/src/modules/DualScreenInfo';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  ETabDiscoveryRoutes,
  IDiscoveryModalParamList,
  ITabDiscoveryParamList,
} from '@onekeyhq/shared/src/routes';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
  ERootRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { EarnHomeWithProvider } from '../../../Earn/EarnHome';
import { HandleRebuildBrowserData } from '../../components/HandleData/HandleRebuildBrowserTabData';
import { isFloatingBrowserChrome } from '../../components/MobileBrowser/browserChrome';
import MobileBrowserBottomBar from '../../components/MobileBrowser/MobileBrowserBottomBar';
import MobileBrowserHeader from '../../components/MobileBrowser/MobileBrowserHeader';
import { OuterTabPagerView } from '../../components/OuterTabPagerView';
import { useDAppNotifyChanges } from '../../hooks/useDAppNotifyChanges';
// import { useEdgeSwipeDetection } from '../../hooks/useEdgeSwipeDetection';
import useMobileBrowserChromeAnimation from '../../hooks/useMobileBrowserChromeAnimation';
import {
  useActiveTabId,
  useDisplayHomePageFlag,
  useWebTabDataById,
  useWebTabs,
} from '../../hooks/useWebTabs';
import { dismissWebviewKeyboard, webviewRefs } from '../../utils/explorerUtils';
import { checkAndCreateFolder } from '../../utils/screenshot';
import { showTabBar, useNotifyTabBarDisplay } from '../../utils/tabBarUtils';
import DashboardContent from '../Dashboard/DashboardContent';

import {
  getExploreTabName,
  getExploreUniversalSearchTabRoute,
} from './exploreTabUtils';
import MobileBrowserContent from './MobileBrowserContent';
import { withBrowserProvider } from './WithBrowserProvider';

import type { IEarnBorrowPagerViewRef } from '../../../Earn/components/EarnBorrowPagerView';
import type { RouteProp } from '@react-navigation/core';
import type { WebView } from 'react-native-webview';

type IExploreTabSwitchType = 'default' | 'tap' | 'swipe';

const styles = StyleSheet.create({
  // iOS WKWebViews must stay in the native layout tree. In nested layouts,
  // display:none can reload the page even though React keeps it mounted.
  webPageLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 3,
  },
  webPageRootLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 3,
  },
  iosWebPageRootLayerVisible: {
    opacity: 1,
    zIndex: 3,
  },
  iosWebPageRootLayerHidden: {
    opacity: 0,
    zIndex: 0,
  },
  webPageRootToolbar: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 4,
  },
});

const useAndroidHardwareBack = platformEnv.isNativeAndroid
  ? ({
      displayHomePage,
      activeTabData,
      activeTabId,
      handleGoBackHome,
    }: {
      displayHomePage: boolean;
      activeTabData: { canGoBack?: boolean } | undefined;
      activeTabId: string | undefined | null;
      handleGoBackHome: () => Promise<void> | void;
    }) => {
      const isDiscoveryTabFocused = useRef(true);
      useListenTabFocusState(
        ETabRoutes.Discovery,
        (isFocus: boolean, isHideByModal: boolean) => {
          isDiscoveryTabFocused.current = isFocus && !isHideByModal;
        },
      );

      useEffect(() => {
        const onBackPress = () => {
          if (!isDiscoveryTabFocused.current || displayHomePage) {
            return false;
          }
          if (!displayHomePage && activeTabData?.canGoBack && activeTabId) {
            const webviewRef = webviewRefs[activeTabId];
            if (webviewRef?.innerRef) {
              try {
                (webviewRef.innerRef as WebView)?.goBack();
              } catch (error) {
                console.error('Error while navigating back:', error);
              }
            }
          } else {
            void handleGoBackHome();
          }

          // Prevent default behavior
          return true;
        };

        const subscription = BackHandler.addEventListener(
          'hardwareBackPress',
          onBackPress,
        );
        return () => subscription.remove();
      }, [
        activeTabId,
        activeTabData?.canGoBack,
        displayHomePage,
        handleGoBackHome,
      ]);
    }
  : () => {};

const MAX_POP_DEPTH = 10;
const popToDiscoveryHomePage = (depth = 0) => {
  if (depth >= MAX_POP_DEPTH) {
    return;
  }
  const rootState = rootNavigationRef.current?.getRootState();
  const currentIndex = rootState?.index || 0;
  const routes = rootState?.routes || [];
  const currentRoute = routes[currentIndex];
  if (currentRoute?.name === ERootRoutes.Main) {
    if (currentRoute.state) {
      const tabIndex = currentRoute.state.index || 0;
      const discoveryRoute = currentRoute.state.routes[tabIndex];
      if (discoveryRoute?.name === ETabRoutes.Discovery) {
        const discoveryState = discoveryRoute?.state;
        if (
          discoveryState?.index !== 0 &&
          rootNavigationRef.current?.canGoBack()
        ) {
          rootNavigationRef.current?.goBack();
          setTimeout(() => {
            popToDiscoveryHomePage(depth + 1);
          });
        }
      }
    }
  }
};

function MobileBrowser() {
  const isTabletMainView = useSplitMainView();
  const isTabletDetailView = useSplitSubView();
  const isDualScreen = isDualScreenDevice();
  const route =
    useRoute<
      RouteProp<ITabDiscoveryParamList, ETabDiscoveryRoutes.TabDiscovery>
    >();
  const isLandscape = useIsSplitView();
  const { defaultTab, earnTab } = route?.params || {};
  const [settings] = useSettingsPersistAtom();
  const rawSelectedHeaderTab =
    settings.selectedBrowserTab || ETranslations.global_browser;
  const selectedHeaderTab =
    rawSelectedHeaderTab === ETranslations.global_earn
      ? ETranslations.global_earn
      : ETranslations.global_browser;
  // Pages the outer pager is actually painting. Tracked separately from
  // selectedHeaderTab, which only commits after the swipe finishes — the
  // gap between the two is what showed a blank page mid-swipe (OK-60300).
  const [visibleOuterPages, setVisibleOuterPages] = useState<number[]>([]);
  const handleVisiblePagesChange = useCallback((pages: number[]) => {
    setVisibleOuterPages((prev) =>
      prev.length === pages.length && prev.every((v, i) => v === pages[i])
        ? prev
        : pages,
    );
  }, []);
  const isEarnPageVisible =
    selectedHeaderTab === ETranslations.global_earn ||
    visibleOuterPages.includes(0);
  const exploreTabSwitchTypeRef = useRef<IExploreTabSwitchType>('default');
  const hasLoggedExploreTabViewRef = useRef(false);

  // Shared value for swipe-following header tab animation.
  // Maps tab enum to pager index: earn=0, browser=1.
  const initialPageIndex = useMemo(() => {
    if (selectedHeaderTab === ETranslations.global_earn) return 0;
    return 1;
  }, [selectedHeaderTab]);
  const outerPageScrollPosition = useSharedValue(initialPageIndex);

  // Under the Browser tab the universal search defaults to the Dapps tab so its
  // results show dapp content first, while keeping the full search scope so the
  // Market/Perp/Wallet tabs are still available to switch to (OK-56756). Do NOT
  // narrow the search scope here — that would drop those tabs entirely.
  const searchInitialTab = useMemo(() => {
    if (selectedHeaderTab === ETranslations.global_browser) {
      return 'dapp' as const;
    }
    return undefined;
  }, [selectedHeaderTab]);
  const universalSearchTabRoute =
    getExploreUniversalSearchTabRoute(selectedHeaderTab);

  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const { closeWebTab } = useBrowserTabActions().current;
  const { tab: activeTabData } = useWebTabDataById(activeTabId ?? '');
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();
  const {
    handleScroll,
    expandBrowserChrome,
    chromeProgress,
    toolbarAnimatedStyle,
    toolbarOverlayStyle,
    webPageAnimatedStyle,
    fullBarHeight,
  } = useMobileBrowserChromeAnimation();
  useDAppNotifyChanges({ tabId: activeTabId });

  useDebugComponentRemountLog({
    name: 'MobileBrowser3864',
  });

  const { displayHomePage } = useDisplayHomePageFlag();
  const showDiscoveryPage = useMemo(() => {
    if (isTabletMainView) {
      return true;
    }
    if (isTabletDetailView) {
      return isLandscape ? false : displayHomePage;
    }
    return displayHomePage;
  }, [isTabletMainView, isTabletDetailView, displayHomePage, isLandscape]);
  const isBrowserHeaderTabSelected =
    selectedHeaderTab === ETranslations.global_browser;
  const isBrowserWebPageVisible =
    isBrowserHeaderTabSelected && !showDiscoveryPage && !displayHomePage;
  // The dashboard scroll shares the chrome animation, so make sure the web page
  // always opens (or switches tab) with its header and bottom bar expanded.
  useEffect(() => {
    if (isBrowserWebPageVisible) {
      expandBrowserChrome();
    }
  }, [activeTabId, isBrowserWebPageVisible, expandBrowserChrome]);
  const isBrowserDashboardActive =
    showDiscoveryPage &&
    (isBrowserHeaderTabSelected || visibleOuterPages.includes(1));
  const shouldKeepBrowserTabLayerAttached =
    platformEnv.isNativeIOSPad && isTabletDetailView;
  const shouldDismissKeyboardOnTabSwitch =
    platformEnv.isNativeIOSPad && !isTabletMainView;

  useEffect(() => {
    if (!tabs?.length) {
      showTabBar();
    }
  }, [tabs?.length]);

  useEffect(() => {
    if (rawSelectedHeaderTab === ETranslations.global_market) {
      void backgroundApiProxy.serviceSetting.setSelectedBrowserTab(
        ETranslations.global_browser,
      );
    }
  }, [rawSelectedHeaderTab]);

  const previousDefaultTab = useRef<ETranslations | undefined>(undefined);
  useEffect(() => {
    if (previousDefaultTab.current !== defaultTab) {
      defaultLogger.market.navigation.discoveryDefaultTabParam({
        defaultTab,
        previousDefaultTab: previousDefaultTab.current,
      });
      previousDefaultTab.current = defaultTab;
      if (defaultTab === ETranslations.global_market) {
        navigation.switchTab(ETabRoutes.Market);
      } else if (defaultTab) {
        void backgroundApiProxy.serviceSetting.setSelectedBrowserTab(
          defaultTab,
        );
      }
    }
  }, [defaultTab, navigation]);

  useEffect(() => {
    if (!showDiscoveryPage) {
      return;
    }

    const switchType = hasLoggedExploreTabViewRef.current
      ? exploreTabSwitchTypeRef.current
      : 'default';

    hasLoggedExploreTabViewRef.current = true;
    defaultLogger.discovery.browser.exploreTabView({
      tabName: getExploreTabName(selectedHeaderTab),
      switchType,
    });
    exploreTabSwitchTypeRef.current = 'default';
  }, [selectedHeaderTab, showDiscoveryPage]);

  const { setDisplayHomePage } = useBrowserTabActions().current;
  const firstRender = useRef(true);
  useEffect(() => {
    if (!firstRender.current && tabs.length === 0) {
      setDisplayHomePage(true);
    }
    if (firstRender.current) {
      firstRender.current = false;
    }
  }, [tabs.length, setDisplayHomePage]);

  useEffect(() => {
    void checkAndCreateFolder();
  }, []);

  const closeCurrentWebTab = useCallback(async () => {
    showTabBar();
    if (activeTabId) {
      closeWebTab({ tabId: activeTabId, entry: 'Menu' });
      setDisplayHomePage(true);
    }
    return Promise.resolve();
  }, [activeTabId, closeWebTab, setDisplayHomePage]);

  useEffect(() => {
    const listener = async (event: {
      tab: ETranslations;
      openUrl?: boolean;
      showWebPage?: boolean;
      switchType?: IExploreTabSwitchType;
    }) => {
      defaultLogger.market.navigation.discoveryTabSwitchReceived({
        tab: event.tab,
        switchType: event.switchType,
        displayHomePage,
        openUrl: event.openUrl,
        showWebPage: event.showWebPage,
      });
      if (event.tab === ETranslations.global_market) {
        navigation.switchTab(ETabRoutes.Market);
        return;
      }
      exploreTabSwitchTypeRef.current = event.switchType ?? 'default';

      // State machine: when WebView is open (displayHomePage === false) and
      // switching to a non-Browser tab, first collapse the WebView back to
      // Dashboard before switching the main tab.
      // If the target is Browser itself, do NOT collapse the WebView.
      if (!displayHomePage && event.tab !== ETranslations.global_browser) {
        if (shouldDismissKeyboardOnTabSwitch) {
          dismissWebviewKeyboard(activeTabId ?? undefined);
        }
        setDisplayHomePage(true);
      }
      if (event.tab === ETranslations.global_browser && event.showWebPage) {
        setDisplayHomePage(false);
      }

      await backgroundApiProxy.serviceSetting.setSelectedBrowserTab(event.tab);
      defaultLogger.market.navigation.discoveryTabSwitchApplied({
        tab: event.tab,
      });
      if (event.tab === ETranslations.global_browser && event.openUrl) {
        setTimeout(() => {
          popToDiscoveryHomePage();
        }, 50);
      }
    };
    appEventBus.on(EAppEventBusNames.SwitchDiscoveryTabInNative, listener);
    return () => {
      appEventBus.off(EAppEventBusNames.SwitchDiscoveryTabInNative, listener);
    };
  }, [
    activeTabId,
    displayHomePage,
    navigation,
    setDisplayHomePage,
    shouldDismissKeyboardOnTabSwitch,
  ]);

  // For risk detection
  useEffect(() => {
    const listener = () => {
      void closeCurrentWebTab();
    };
    appEventBus.on(EAppEventBusNames.CloseCurrentBrowserTab, listener);
    return () => {
      appEventBus.off(EAppEventBusNames.CloseCurrentBrowserTab, listener);
    };
  }, [closeCurrentWebTab]);

  // Only the legacy tablet layout requires display:none gating across panes;
  // phone layouts keep Market, Earn, and Browser in the outer pager.
  const useOuterPager = !isTabletMainView && !isTabletDetailView;
  // Phone layout only: the iPad split layout keeps the bar in-flow.
  const webContentBottomInset =
    isFloatingBrowserChrome && useOuterPager ? fullBarHeight : undefined;
  const content = useMemo(
    () =>
      tabs.map((t) => (
        <MobileBrowserContent
          id={t.id}
          key={t.id}
          isBrowserContentVisible={isBrowserWebPageVisible}
          onScroll={handleScroll}
          contentBottomInset={webContentBottomInset}
        />
      )),
    [tabs, handleScroll, isBrowserWebPageVisible, webContentBottomInset],
  );

  useNotifyTabBarDisplay(
    !!activeTabId &&
      !displayHomePage &&
      !isTabletMainView &&
      selectedHeaderTab === ETranslations.global_browser,
  );

  // Read through refs so the chrome callbacks (and the memoized header/bar)
  // stay stable while tabs update.
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const handleSearchBarPress = useCallback(
    (url: string) => {
      const currentTabId = activeTabIdRef.current;
      const tab = tabsRef.current.find((t) => t.id === currentTabId);
      navigation.pushModal(EModalRoutes.DiscoveryModal, {
        screen: EDiscoveryModalRoutes.SearchModal,
        params: {
          url,
          tabId: currentTabId ?? undefined,
          useCurrentWindow: tab?.isPinned ? false : !!currentTabId,
        },
      });
    },
    [navigation],
  );
  const browserChrome = useMemo(
    () => ({
      progress: chromeProgress,
      onExpand: expandBrowserChrome,
      onSearchBarPress: handleSearchBarPress,
    }),
    [chromeProgress, expandBrowserChrome, handleSearchBarPress],
  );

  const { top } = useSafeAreaInsets();
  // iOS 26: the Discover search bar opts into the Liquid Glass capsule (so it
  // matches the Wallet header's glass search bar) and is nudged down so its
  // center vertically aligns with the Wallet search bar — which sits centered in
  // a 56pt row, i.e. ~6pt lower than this bar's safe-area-top anchor. Off iOS 26
  // / Android nothing changes.
  const searchGlassActive = isLiquidGlassAvailable();
  let discoverSearchTop = top;
  if (platformEnv.isNativeAndroid) {
    discoverSearchTop = top + 5;
  } else if (searchGlassActive) {
    discoverSearchTop = top + 6;
  }
  const takeScreenshot = useTakeScreenshot(activeTabId);

  const handleGoBackHome = useCallback(async () => {
    dismissWebviewKeyboard(activeTabId ?? undefined);

    await Promise.race([
      takeScreenshot(),
      timerUtils.setTimeoutPromised(undefined, 2000),
    ]);
    setTimeout(() => {
      setDisplayHomePage(true);
      showTabBar();
    });
  }, [takeScreenshot, setDisplayHomePage, activeTabId]);

  useAndroidHardwareBack({
    displayHomePage,
    activeTabData,
    activeTabId,
    handleGoBackHome,
  });

  // Refs for inner tab containers (Earn) to sync after freeze/unfreeze
  const earnTabsRef = useRef<ITabContainerRef>(null);
  const earnBorrowPagerRef = useRef<IEarnBorrowPagerViewRef>(null);

  const handleExploreTabSwipe = useCallback(() => {
    exploreTabSwitchTypeRef.current = 'swipe';
  }, []);

  const isShowContent = useMemo(() => {
    if (
      ExpoDevice.deviceType !== ExpoDevice.DeviceType.TABLET &&
      !isDualScreen
    ) {
      return true;
    }
    if (isTabletMainView && isLandscape) {
      return true;
    }
    return isTabletDetailView && !isLandscape;
  }, [isDualScreen, isTabletMainView, isLandscape, isTabletDetailView]);
  const shouldShowTabletHomeContainer =
    isTabletDetailView && isLandscape && displayHomePage;
  // Android can keep the early return. On iPad, render the placeholder as an
  // overlay so the active WKWebView remains attached underneath it.
  if (shouldShowTabletHomeContainer && !shouldKeepBrowserTabLayerAttached) {
    return <TabletHomeContainer />;
  }

  const displayBottomBar = isBrowserWebPageVisible;
  const shouldShowRootWebPageLayer = useOuterPager && isBrowserWebPageVisible;
  const browserDashboardContent = (
    <View
      collapsable={false}
      pointerEvents={showDiscoveryPage ? 'auto' : 'none'}
      accessibilityElementsHidden={!showDiscoveryPage}
      importantForAccessibility={
        showDiscoveryPage ? 'auto' : 'no-hide-descendants'
      }
      style={{
        flex: 1,
        opacity: showDiscoveryPage ? 1 : 0,
      }}
    >
      <DashboardContent
        isActive={isBrowserDashboardActive}
        onScroll={handleScroll}
      />
    </View>
  );

  return (
    <Page fullPage>
      {/* custom header */}

      {showDiscoveryPage ? (
        <YStack
          bg="$bgApp"
          // Keep the visible header and the space above the pager in the same
          // layout tree, so async native measurement cannot move the page body.
          // iOS 26 needs 58pt for the lower 44pt glass search bar and its gap.
          pt={searchGlassActive ? 58 : '$12'}
          width="100%"
        >
          <Stack
            position="absolute"
            top={discoverSearchTop}
            px="$5"
            {...(searchGlassActive && { left: 0, right: 0 })}
          >
            <LegacyUniversalSearchInput
              size="medium"
              glass
              initialTab={searchInitialTab}
              tabRoute={universalSearchTabRoute}
            />
          </Stack>
          <TabPageHeader
            sceneName={EAccountSelectorSceneName.home}
            tabRoute={ETabRoutes.Discovery}
            selectedHeaderTab={selectedHeaderTab}
            // Tablet has no outer pager updates, so omit its shared position.
            pageScrollPosition={
              useOuterPager ? outerPageScrollPosition : undefined
            }
          />
        </YStack>
      ) : (
        <MobileBrowserHeader
          chrome={browserChrome}
          onGoBackHome={handleGoBackHome}
        />
      )}
      <Page.Body>
        {/* HandleRebuildBrowserData must mount early regardless of active tab */}
        <HandleRebuildBrowserData />
        {useOuterPager ? (
          <>
            <OuterTabPagerView
              selectedHeaderTab={selectedHeaderTab}
              showDiscoveryPage={showDiscoveryPage}
              onPageSelectedBySwipe={handleExploreTabSwipe}
              pageScrollPosition={outerPageScrollPosition}
              earnTabsRef={earnTabsRef}
              earnBorrowPagerRef={earnBorrowPagerRef}
              onVisiblePagesChange={handleVisiblePagesChange}
              earnContent={
                <EarnHomeWithProvider
                  showHeader={false}
                  showContent={selectedHeaderTab === ETranslations.global_earn}
                  isVisible={isEarnPageVisible}
                  defaultTab={earnTab}
                  tabsRef={earnTabsRef}
                  useSwipePager={useOuterPager}
                  earnBorrowPagerRef={earnBorrowPagerRef}
                />
              }
              browserContent={
                <Stack flex={1} zIndex={3}>
                  <Stack flex={1}>
                    {browserDashboardContent}
                    {platformEnv.isNativeAndroid ? (
                      <Animated.View
                        collapsable={false}
                        pointerEvents={
                          shouldShowRootWebPageLayer ? 'auto' : 'none'
                        }
                        accessibilityElementsHidden={
                          !shouldShowRootWebPageLayer
                        }
                        importantForAccessibility={
                          shouldShowRootWebPageLayer
                            ? 'auto'
                            : 'no-hide-descendants'
                        }
                        style={[styles.webPageLayer, webPageAnimatedStyle]}
                      >
                        <Freeze freeze={showDiscoveryPage}>{content}</Freeze>
                      </Animated.View>
                    ) : null}
                  </Stack>
                </Stack>
              }
            />
            {/* iOS WebView layer: keeps full height under the floating bar
                (see useMobileBrowserChromeAnimation). */}
            {platformEnv.isNativeIOS ? (
              <Animated.View
                collapsable={false}
                pointerEvents={shouldShowRootWebPageLayer ? 'auto' : 'none'}
                accessibilityElementsHidden={!shouldShowRootWebPageLayer}
                importantForAccessibility={
                  shouldShowRootWebPageLayer ? 'auto' : 'no-hide-descendants'
                }
                style={[
                  styles.webPageRootLayer,
                  webPageAnimatedStyle,
                  shouldShowRootWebPageLayer
                    ? styles.iosWebPageRootLayerVisible
                    : styles.iosWebPageRootLayerHidden,
                ]}
              >
                {content}
              </Animated.View>
            ) : null}
            <Freeze freeze={!displayBottomBar}>
              <Animated.View
                pointerEvents={shouldShowRootWebPageLayer ? 'box-none' : 'none'}
                style={[
                  styles.webPageRootToolbar,
                  toolbarOverlayStyle,
                  {
                    display: shouldShowRootWebPageLayer ? 'flex' : 'none',
                  },
                ]}
              >
                <MobileBrowserBottomBar
                  id={activeTabId ?? ''}
                  onGoBackHomePage={handleGoBackHome}
                  chrome={browserChrome}
                />
              </Animated.View>
            </Freeze>
          </>
        ) : (
          <>
            {/* Keep iPad browser layers attached; Android retains legacy display switching. */}
            <Stack
              flex={1}
              zIndex={shouldKeepBrowserTabLayerAttached ? undefined : 3}
              collapsable={false}
              pointerEvents={
                shouldKeepBrowserTabLayerAttached && !isBrowserHeaderTabSelected
                  ? 'none'
                  : 'auto'
              }
              accessibilityElementsHidden={
                shouldKeepBrowserTabLayerAttached
                  ? !isBrowserHeaderTabSelected
                  : undefined
              }
              importantForAccessibility={
                shouldKeepBrowserTabLayerAttached && !isBrowserHeaderTabSelected
                  ? 'no-hide-descendants'
                  : 'auto'
              }
              display={
                shouldKeepBrowserTabLayerAttached || isBrowserHeaderTabSelected
                  ? undefined
                  : 'none'
              }
              style={[
                shouldKeepBrowserTabLayerAttached && styles.webPageRootLayer,
                shouldKeepBrowserTabLayerAttached &&
                  (isBrowserHeaderTabSelected
                    ? styles.iosWebPageRootLayerVisible
                    : styles.iosWebPageRootLayerHidden),
              ]}
            >
              <Stack flex={1}>
                <View
                  style={{
                    display: showDiscoveryPage ? 'flex' : 'none',
                    flex: showDiscoveryPage ? 1 : undefined,
                  }}
                >
                  <DashboardContent
                    isActive={isBrowserDashboardActive}
                    onScroll={handleScroll}
                  />
                </View>
                {!isTabletMainView ? (
                  <View
                    collapsable={false}
                    pointerEvents={isBrowserWebPageVisible ? 'auto' : 'none'}
                    accessibilityElementsHidden={!isBrowserWebPageVisible}
                    importantForAccessibility={
                      isBrowserWebPageVisible ? 'auto' : 'no-hide-descendants'
                    }
                    style={[
                      styles.webPageLayer,
                      platformEnv.isNativeIOSPad &&
                        (isBrowserWebPageVisible
                          ? styles.iosWebPageRootLayerVisible
                          : styles.iosWebPageRootLayerHidden),
                      !platformEnv.isNativeIOSPad && {
                        display: showDiscoveryPage ? 'none' : 'flex',
                      },
                    ]}
                  >
                    {content}
                  </View>
                ) : null}
              </Stack>
              <Freeze freeze={!displayBottomBar}>
                <Animated.View
                  style={[
                    toolbarAnimatedStyle,
                    {
                      bottom: 0,
                      left: 0,
                      right: 0,
                    },
                  ]}
                >
                  <MobileBrowserBottomBar
                    id={activeTabId ?? ''}
                    onGoBackHomePage={handleGoBackHome}
                    chrome={browserChrome}
                  />
                </Animated.View>
              </Freeze>
            </Stack>
            {isShowContent ? (
              <View
                style={{
                  flex: 1,
                  display:
                    selectedHeaderTab === ETranslations.global_earn
                      ? 'flex'
                      : 'none',
                }}
              >
                <EarnHomeWithProvider
                  showHeader={false}
                  showContent={selectedHeaderTab === ETranslations.global_earn}
                  defaultTab={earnTab}
                />
              </View>
            ) : null}
          </>
        )}
      </Page.Body>
      {shouldShowTabletHomeContainer ? (
        <Stack
          position="absolute"
          top={0}
          right={0}
          bottom={0}
          left={0}
          zIndex={5}
        >
          <TabletHomeContainer />
        </Stack>
      ) : null}
    </Page>
  );
}

function BaseMobileBrowser() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <LazyPageContainer>
        <MobileBrowser />
      </LazyPageContainer>
    </AccountSelectorProviderMirror>
  );
}

export default memo(withBrowserProvider(BaseMobileBrowser));
