import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import * as ExpoDevice from 'expo-device';
import { Freeze } from 'react-freeze';
import { BackHandler, type LayoutChangeEvent, View } from 'react-native';
import Animated, { useSharedValue } from 'react-native-reanimated';

import {
  Icon,
  Page,
  Stack,
  XStack,
  YStack,
  rootNavigationRef,
  useIsSplitView,
  useSafeAreaInsets,
  useSplitMainView,
  useSplitSubView,
} from '@onekeyhq/components';
import type { ITabContainerRef } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
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
import { webviewRefs } from '../../utils/explorerUtils';
import { checkAndCreateFolder } from '../../utils/screenshot';
import { showTabBar, useNotifyTabBarDisplay } from '../../utils/tabBarUtils';
import DashboardContent from '../Dashboard/DashboardContent';

import MobileBrowserContent from './MobileBrowserContent';
import { withBrowserProvider } from './WithBrowserProvider';

import type { IEarnBorrowPagerViewRef } from '../../../Earn/components/EarnBorrowPagerView';
import type { RouteProp } from '@react-navigation/core';
import type { WebView } from 'react-native-webview';

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
  const { earnTab } = route?.params || {};
  const [settings] = useSettingsPersistAtom();
  const selectedHeaderTab =
    settings.selectedBrowserTab || ETranslations.global_browser;

  // Shared value for swipe-following header tab animation.
  // Maps tab enum to pager index: market=0, earn=1, browser=2.
  const initialPageIndex = useMemo(() => {
    if (selectedHeaderTab === ETranslations.global_market) return 0;
    if (selectedHeaderTab === ETranslations.global_earn) return 1;
    return 2;
  }, [selectedHeaderTab]);
  const outerPageScrollPosition = useSharedValue(initialPageIndex);

  const searchInitialTab = useMemo(() => {
    if (selectedHeaderTab === ETranslations.global_market) {
      return 'market' as const;
    }
    if (selectedHeaderTab === ETranslations.global_browser) {
      return 'dapp' as const;
    }
    return undefined;
  }, [selectedHeaderTab]);

  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const { closeWebTab } = useBrowserTabActions().current;
  const { tab: activeTabData } = useWebTabDataById(activeTabId ?? '');
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();
  const { handleScroll, toolbarAnimatedStyle } =
    useMobileBottomBarAnimation(activeTabId);
  useDAppNotifyChanges({ tabId: activeTabId });

  useDebugComponentRemountLog({
    name: 'MobileBrowser3864',
  });

  const { displayHomePage } = useDisplayHomePageFlag();

  useEffect(() => {
    if (!tabs?.length) {
      showTabBar();
    }
  }, [tabs?.length]);

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
    return activeTabId
      ? closeWebTab({ tabId: activeTabId, entry: 'Menu' })
      : Promise.resolve();
  }, [activeTabId, closeWebTab]);

  useEffect(() => {
    const listener = async (event: {
      tab: ETranslations;
      openUrl?: boolean;
    }) => {
      // State machine: when WebView is open (displayHomePage === false) and
      // switching to a non-Browser tab, first collapse the WebView back to
      // Dashboard before switching the main tab.
      // If the target is Browser itself, do NOT collapse the WebView.
      if (!displayHomePage && event.tab !== ETranslations.global_browser) {
        setDisplayHomePage(true);
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
  }, [displayHomePage, setDisplayHomePage]);

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
        <MobileBrowserContent id={t.id} key={t.id} onScroll={handleScroll} />
      )),
    [tabs, handleScroll],
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
  const takeScreenshot = useTakeScreenshot(activeTabId);

  const handleGoBackHome = useCallback(async () => {
    // Execute blur() to hide keyboard on the current webview
    if (activeTabId) {
      const webviewRef = webviewRefs[activeTabId];
      if (webviewRef?.innerRef) {
        try {
          // Inject JavaScript to blur any focused input elements
          (webviewRef.innerRef as WebView)?.injectJavaScript(`
            try {
              if (document.activeElement && document.activeElement.blur) {
                document.activeElement.blur();
              }
              // Also try to blur any input elements that might be focused
              const inputs = document.querySelectorAll('input, textarea');
              inputs.forEach(function(input) {
                if (input === document.activeElement) {
                  input.blur();
                }
              });
            } catch (e) {
              console.error('Error blurring elements:', e);
            }
          `);
        } catch (error) {
          console.error('Error injecting blur script:', error);
        }
      }
    }

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

  // Determine if outer PagerView should be used (phone only, not tablet/dual-screen)
  const useOuterPager =
    !isTabletMainView && !isTabletDetailView && !isDualScreen;

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

  const showDiscoveryPage = useMemo(() => {
    if (isTabletMainView) {
      return true;
    }
    if (isTabletDetailView) {
      return isLandscape ? false : displayHomePage;
    }
    return displayHomePage;
  }, [isTabletMainView, isTabletDetailView, displayHomePage, isLandscape]);

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
  if (isTabletDetailView && isLandscape && displayHomePage) {
    return <TabletHomeContainer />;
  }

  const displayBottomBar = !showDiscoveryPage;

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
          <OuterTabPagerView
            selectedHeaderTab={selectedHeaderTab}
            showDiscoveryPage={showDiscoveryPage}
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
                showContent
                defaultTab={earnTab}
                tabsRef={earnTabsRef}
                useSwipePager={useOuterPager}
                earnBorrowPagerRef={earnBorrowPagerRef}
              />
            }
            browserContent={
              <Stack flex={1} zIndex={3}>
                <Stack flex={1}>
                  <View
                    style={{
                      display: showDiscoveryPage ? 'flex' : 'none',
                      flex: showDiscoveryPage ? 1 : undefined,
                    }}
                  >
                    <DashboardContent onScroll={handleScroll} />
                  </View>
                  <Freeze freeze={showDiscoveryPage}>{content}</Freeze>
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
            }
          />
        ) : (
          <>
            {/* Tablet / DualScreen: keep legacy display:none/flex switching */}
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
              zIndex={3}
              display={
                selectedHeaderTab === ETranslations.global_browser
                  ? undefined
                  : 'none'
              }
            >
              <Stack flex={1}>
                <View
                  style={{
                    display: showDiscoveryPage ? 'flex' : 'none',
                    flex: showDiscoveryPage ? 1 : undefined,
                  }}
                >
                  <DashboardContent onScroll={handleScroll} />
                </View>
                {!isTabletMainView ? (
                  <Freeze freeze={showDiscoveryPage}>{content}</Freeze>
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
          pt="$12"
          width="100%"
          onLayout={handleTabPageLayout}
        >
          <Stack
            position="absolute"
            top={platformEnv.isNativeAndroid ? top + 5 : top}
            px="$5"
          >
            <LegacyUniversalSearchInput
              size="medium"
              initialTab={searchInitialTab}
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
    </Page>
  );
}

function BaseMobileBrowser() {
  return (
    <LazyPageContainer>
      <MobileBrowser />
    </LazyPageContainer>
  );
}

export default memo(withBrowserProvider(BaseMobileBrowser));
