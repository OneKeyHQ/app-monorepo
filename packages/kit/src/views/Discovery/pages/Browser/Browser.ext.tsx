import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import * as ExpoDevice from 'expo-device';
import { Freeze } from 'react-freeze';
import { BackHandler, type LayoutChangeEvent } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  Icon,
  Page,
  Stack,
  XStack,
  YStack,
  rootNavigationRef,
  useIsNativeTablet,
  useIsTabletDetailView,
  useIsTabletMainView,
  useOrientation,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
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
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { EarnHomeWithProvider } from '../../../Earn/EarnHome';
import { MarketHomeWithProvider } from '../../../Market/MarketHomeV2/MarketHomeV2';
import CustomHeaderTitle from '../../components/CustomHeaderTitle';
import { HandleRebuildBrowserData } from '../../components/HandleData/HandleRebuildBrowserTabData';
import HeaderRightToolBar from '../../components/HeaderRightToolBar';
import MobileBrowserBottomBar from '../../components/MobileBrowser/MobileBrowserBottomBar';
import { useDAppNotifyChanges } from '../../hooks/useDAppNotifyChanges';
import useMobileBottomBarAnimation from '../../hooks/useMobileBottomBarAnimation';
import {
  useActiveTabId,
  useDisplayHomePageFlag,
  useWebTabDataById,
  useWebTabs,
} from '../../hooks/useWebTabs';
import { webviewRefs } from '../../utils/explorerUtils';
import { checkAndCreateFolder } from '../../utils/screenshot';
import { showTabBar } from '../../utils/tabBarUtils';
import DashboardContent from '../Dashboard/DashboardContent';

import MobileBrowserContent from './MobileBrowserContent';
import { withBrowserProvider } from './WithBrowserProvider';

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
        // Only add back handler on Android
        if (!platformEnv.isNativeAndroid) {
          return;
        }

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

const popToDiscoveryHomePage = () => {
  const rootState = rootNavigationRef.current?.getState();
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
            popToDiscoveryHomePage();
          });
        }
      }
    }
  }
};

function MobileBrowser() {
  const isTabletDevice = useIsNativeTablet();
  const isTabletMainView = useIsTabletMainView();
  const isTabletDetailView = useIsTabletDetailView();
  const isDualScreen = isDualScreenDevice();
  const route =
    useRoute<
      RouteProp<ITabDiscoveryParamList, ETabDiscoveryRoutes.TabDiscovery>
    >();
  const isLandscape = useOrientation();
  const { defaultTab, earnTab } = route?.params || {};
  const [settings] = useSettingsPersistAtom();
  const [selectedHeaderTab, setSelectedHeaderTab] = useState<ETranslations>(
    isTabletDevice && isTabletDetailView && isLandscape
      ? ETranslations.global_browser
      : defaultTab ||
          settings.selectedBrowserTab ||
          ETranslations.global_market,
  );
  const handleChangeHeaderTab = useCallback(
    async (tab: ETranslations) => {
      if (isTabletDevice && isTabletDetailView && isLandscape) {
        return;
      }
      setSelectedHeaderTab(tab);
      setTimeout(async () => {
        await backgroundApiProxy.serviceSetting.setSelectedBrowserTab(tab);
      }, 150);
    },
    [isLandscape, isTabletDetailView, isTabletDevice],
  );

  const searchInitialTab = useMemo(() => {
    if (selectedHeaderTab === ETranslations.global_market) {
      return 'market' as const;
    }
    if (selectedHeaderTab === ETranslations.global_browser) {
      return 'dapp' as const;
    }
    return undefined;
  }, [selectedHeaderTab]);

  const previousDefaultTab = useRef<ETranslations | undefined>(defaultTab);
  useEffect(() => {
    if (previousDefaultTab.current !== defaultTab) {
      previousDefaultTab.current = defaultTab;
      if (defaultTab) {
        setTimeout(async () => {
          await handleChangeHeaderTab(defaultTab);
        }, 100);
      }
    }
  }, [defaultTab, handleChangeHeaderTab]);
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const { closeWebTab } = useBrowserTabActions().current;
  const { tab: activeTabData } = useWebTabDataById(activeTabId ?? '');
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();
  const { handleScroll, toolbarRef, toolbarAnimatedStyle } =
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
  }, [tabs]);

  const { setDisplayHomePage } = useBrowserTabActions().current;
  const firstRender = useRef(true);
  useEffect(() => {
    if (!firstRender.current && tabs.length === 0) {
      setDisplayHomePage(true);
    }
    if (firstRender.current) {
      firstRender.current = false;
    }
  }, [tabs, navigation, setDisplayHomePage]);

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
    const listener = (event: { tab: ETranslations; openUrl?: boolean }) => {
      void handleChangeHeaderTab(event.tab);
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
  }, [handleChangeHeaderTab]);

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

    try {
      await takeScreenshot();
    } catch (e) {
      console.error('takeScreenshot error: ', e);
    }
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

  const [tabPageHeight, setTabPageHeight] = useState(
    platformEnv.isNativeIOS ? 153 : 100,
  );
  const handleTabPageLayout = useCallback((e: LayoutChangeEvent) => {
    if (platformEnv.isNativeIOS) {
      return;
    }
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
        {/* Market Tab */}
        {isShowContent ? (
          <Stack
            flex={1}
            display={
              selectedHeaderTab === ETranslations.global_market
                ? undefined
                : 'none'
            }
          >
            <MarketHomeWithProvider
              isFocused={selectedHeaderTab === ETranslations.global_market}
            />
          </Stack>
        ) : null}
        {/* Browser Tab */}
        <Stack
          flex={1}
          zIndex={3}
          pb={0}
          display={
            selectedHeaderTab === ETranslations.global_browser
              ? undefined
              : 'none'
          }
        >
          <HandleRebuildBrowserData />
          <Stack flex={1}>
            <Stack display={showDiscoveryPage ? 'flex' : 'none'}>
              <DashboardContent onScroll={handleScroll} />
            </Stack>
            {!isTabletMainView ? (
              <Freeze freeze={showDiscoveryPage}>{content}</Freeze>
            ) : null}
          </Stack>
          <Freeze freeze={!displayBottomBar}>
            <Animated.View
              ref={toolbarRef}
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
          <Stack
            flex={1}
            display={
              selectedHeaderTab === ETranslations.global_earn
                ? undefined
                : 'none'
            }
          >
            <EarnHomeWithProvider
              showHeader={false}
              showContent={selectedHeaderTab === ETranslations.global_earn}
              defaultTab={earnTab}
            />
          </Stack>
        ) : null}
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
          <Stack position="absolute" top={top} px="$5">
            <LegacyUniversalSearchInput
              size="medium"
              initialTab={searchInitialTab}
            />
          </Stack>
          <TabPageHeader
            sceneName={EAccountSelectorSceneName.home}
            tabRoute={ETabRoutes.Discovery}
            selectedHeaderTab={selectedHeaderTab}
          />
        </YStack>
      ) : null}
    </Page>
  );
}

export default memo(withBrowserProvider(MobileBrowser));
