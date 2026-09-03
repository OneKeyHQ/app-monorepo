import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import * as ExpoDevice from 'expo-device';
import { Freeze } from 'react-freeze';
import {
  BackHandler,
  type LayoutChangeEvent,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';

import {
  Icon,
  Page,
  Stack,
  XStack,
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
import { MarketHomeWithProvider } from '../../../Market/MarketHomeV2/MarketHomeV2';
import CustomHeaderTitle from '../../components/CustomHeaderTitle';
import { HandleRebuildBrowserData } from '../../components/HandleData/HandleRebuildBrowserTabData';
import HeaderRightToolBar from '../../components/HeaderRightToolBar';
import MobileBrowserBottomBar from '../../components/MobileBrowser/MobileBrowserBottomBar';
import { OuterTabPagerView } from '../../components/OuterTabPagerView';
import { useDAppNotifyChanges } from '../../hooks/useDAppNotifyChanges';
// import { useEdgeSwipeDetection } from '../../hooks/useEdgeSwipeDetection';
import useMobileBottomBarAnimation from '../../hooks/useMobileBottomBarAnimation';
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
  const selectedHeaderTab =
    settings.selectedBrowserTab || ETranslations.global_browser;
  const exploreTabSwitchTypeRef = useRef<IExploreTabSwitchType>('default');
  const hasLoggedExploreTabViewRef = useRef(false);

  // Shared value for swipe-following header tab animation.
  // Maps tab enum to pager index: market=0, earn=1, browser=2.
  const initialPageIndex = useMemo(() => {
    if (selectedHeaderTab === ETranslations.global_market) return 0;
    if (selectedHeaderTab === ETranslations.global_earn) return 1;
    return 2;
  }, [selectedHeaderTab]);
  const outerPageScrollPosition = useSharedValue(initialPageIndex);

  // Under the Browser tab the universal search defaults to the Dapps tab so its
  // results show dapp content first, while keeping the full search scope so the
  // Market/Perp/Wallet tabs are still available to switch to (OK-56756). Do NOT
  // narrow the search scope here — that would drop those tabs entirely.
  const searchInitialTab = useMemo(() => {
    if (selectedHeaderTab === ETranslations.global_market) {
      return 'market' as const;
    }
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
  const { handleScroll, toolbarAnimatedStyle, webPageAnimatedStyle } =
    useMobileBottomBarAnimation(activeTabId);
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
  const isBrowserDashboardActive =
    isBrowserHeaderTabSelected && showDiscoveryPage;
  const shouldKeepBrowserTabLayerAttached =
    platformEnv.isNativeIOSPad && isTabletDetailView;
  const shouldDismissKeyboardOnTabSwitch =
    platformEnv.isNativeIOSPad && !isTabletMainView;

  useEffect(() => {
    if (!tabs?.length) {
      showTabBar();
    }
  }, [tabs?.length]);

  const previousDefaultTab = useRef<ETranslations | undefined>(undefined);
  useEffect(() => {
    if (previousDefaultTab.current !== defaultTab) {
      previousDefaultTab.current = defaultTab;
      if (defaultTab) {
        void backgroundApiProxy.serviceSetting.setSelectedBrowserTab(
          defaultTab,
        );
      }
    }
  }, [defaultTab]);

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

  const content = useMemo(
    () =>
      tabs.map((t) => (
        <MobileBrowserContent
          id={t.id}
          key={t.id}
          isBrowserContentVisible={isBrowserWebPageVisible}
          onScroll={handleScroll}
        />
      )),
    [tabs, handleScroll, isBrowserWebPageVisible],
  );

  useNotifyTabBarDisplay(
    !!activeTabId &&
      !displayHomePage &&
      !isTabletMainView &&
      selectedHeaderTab === ETranslations.global_browser,
  );

  const handleSearchBarPress = useCallback(
    (url: string) => {
      const tab = tabs.find((t) => t.id === activeTabId);
      navigation.pushModal(EModalRoutes.DiscoveryModal, {
        screen: EDiscoveryModalRoutes.SearchModal,
        params: {
          url,
          tabId: activeTabId ?? undefined,
          useCurrentWindow: tab?.isPinned ? false : !!activeTabId,
        },
      });
    },
    [tabs, navigation, activeTabId],
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

  // Refs for inner tab containers (Market/Earn) to sync after freeze/unfreeze
  const marketTabsRef = useRef<ITabContainerRef>(null);
  const earnTabsRef = useRef<ITabContainerRef>(null);
  const earnBorrowPagerRef = useRef<IEarnBorrowPagerViewRef>(null);

  // Determine if outer PagerView should be used (phone-style layout).
  // Only the legacy tablet layout requires display:none gating across panes;
  // that layout is only meaningful when SplitView is actually active (the
  // SplitViewContext provider wraps the routers). When the user disables
  // enableSplitView on a foldable / dual-screen device, neither main nor sub
  // view is set — fall back to the phone-style pager so Market/Earn/Browser
  // can still render. Without this, dual-screen Android with split-screen
  // off renders a blank Market/DeFi page.
  const useOuterPager = !isTabletMainView && !isTabletDetailView;
  const handleExploreTabSwipe = useCallback(() => {
    exploreTabSwitchTypeRef.current = 'swipe';
  }, []);

  const INITIAL_TAB_PAGE_HEIGHT_IOS = 153;
  const INITIAL_TAB_PAGE_HEIGHT_ANDROID = 100;
  const [tabPageHeight, setTabPageHeight] = useState(
    platformEnv.isNativeIOS
      ? INITIAL_TAB_PAGE_HEIGHT_IOS
      : INITIAL_TAB_PAGE_HEIGHT_ANDROID,
  );
  const handleTabPageLayout = useCallback((e: LayoutChangeEvent) => {
    // Use the actual measured height without arbitrary adjustments
    const height = e.nativeEvent.layout.height;
    setTabPageHeight(height);
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
        <Stack h={tabPageHeight} />
      ) : (
        <XStack
          pt={top}
          px="$5"
          alignItems="center"
          my="$1"
          mt={platformEnv.isNativeAndroid ? '$3' : undefined}
        >
          <Stack onPress={handleGoBackHome}>
            <Icon name="MinimizeOutline" mr="$4" />
          </Stack>

          <CustomHeaderTitle handleSearchBarPress={handleSearchBarPress} />
          <HeaderRightToolBar />
        </XStack>
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
              marketTabsRef={marketTabsRef}
              earnTabsRef={earnTabsRef}
              earnBorrowPagerRef={earnBorrowPagerRef}
              marketContent={
                <MarketHomeWithProvider
                  isFocused={selectedHeaderTab === ETranslations.global_market}
                  nestedPager={useOuterPager}
                  tabsRef={marketTabsRef}
                />
              }
              earnContent={
                <EarnHomeWithProvider
                  showHeader={false}
                  showContent={selectedHeaderTab === ETranslations.global_earn}
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
            {/* Resize the iOS WebView with the toolbar so fixed page content
                stays visible above it. */}
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
                pointerEvents={shouldShowRootWebPageLayer ? 'auto' : 'none'}
                style={[
                  styles.webPageRootToolbar,
                  toolbarAnimatedStyle,
                  {
                    display: shouldShowRootWebPageLayer ? 'flex' : 'none',
                  },
                ]}
              >
                <MobileBrowserBottomBar
                  id={activeTabId ?? ''}
                  onGoBackHomePage={handleGoBackHome}
                />
              </Animated.View>
            </Freeze>
          </>
        ) : (
          <>
            {/* Keep iPad browser layers attached; Android retains legacy display switching. */}
            {isShowContent ? (
              <View
                style={{
                  flex: 1,
                  display:
                    selectedHeaderTab === ETranslations.global_market
                      ? 'flex'
                      : 'none',
                }}
              >
                <MarketHomeWithProvider
                  isFocused={selectedHeaderTab === ETranslations.global_market}
                />
              </View>
            ) : null}
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
                shouldKeepBrowserTabLayerAttached && !isBrowserHeaderTabSelected
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
      {showDiscoveryPage ? (
        <YStack
          position="absolute"
          top={0}
          left={0}
          bg="$bgApp"
          // iOS 26: the search bar grew (40->44) and shifted down +6 for Wallet
          // alignment, which ate the gap to the segment row (Market/DeFi/Browser)
          // below it. Push that row down so the gap matches the original ~8pt
          // (6 shift + 44 bar + 8 gap = 58). Off iOS 26 keep the original $12.
          pt={searchGlassActive ? 58 : '$12'}
          width="100%"
          onLayout={handleTabPageLayout}
        >
          <Stack
            position="absolute"
            top={discoverSearchTop}
            px="$5"
            // iOS 26: the glass search bar fills its width via flex, which
            // collapses to 0 inside this shrink-to-fit absolute container — pin
            // left/right so it spans the header width. Off iOS 26 the Stack
            // keeps its original content width (unchanged).
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
            // Only pass pageScrollPosition when OuterTabPagerView is active (phone).
            // On tablet/dual-screen, useOuterPager is false so no onPageScroll
            // events fire — passing the stale shared value would freeze tab colors.
            pageScrollPosition={
              useOuterPager ? outerPageScrollPosition : undefined
            }
          />
        </YStack>
      ) : null}
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
