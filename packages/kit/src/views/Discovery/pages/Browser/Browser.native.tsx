import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import * as ExpoDevice from 'expo-device';
import { Freeze } from 'react-freeze';
import { BackHandler } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  Icon,
  Page,
  Stack,
  XStack,
  YStack,
  useIsTabletDetailView,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TabletHomeContainer } from '@onekeyhq/kit/src/components/TabletHomeContainer';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  ETabDiscoveryRoutes,
  IDiscoveryModalParamList,
  ITabDiscoveryParamList,
} from '@onekeyhq/shared/src/routes';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { useDebugComponentRemountLog } from '@onekeyhq/shared/src/utils/debug/debugUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { EarnHomeWithProvider } from '../../../Earn/EarnHome';
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
import type { LayoutChangeEvent } from 'react-native';
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

function MobileBrowser() {
  const isTabletDevice = ExpoDevice.deviceType === ExpoDevice.DeviceType.TABLET;
  const isTabletDetailView = useIsTabletDetailView();
  const route =
    useRoute<
      RouteProp<ITabDiscoveryParamList, ETabDiscoveryRoutes.TabDiscovery>
    >();
  const { defaultTab, earnTab } = route?.params || {};
  const [settings] = useSettingsPersistAtom();
  const [selectedHeaderTab, setSelectedHeaderTab] = useState<ETranslations>(
    isTabletDevice && isTabletDetailView
      ? ETranslations.global_browser
      : defaultTab ||
          settings.selectedBrowserTab ||
          ETranslations.global_browser,
  );
  const handleChangeHeaderTab = useCallback(
    async (tab: ETranslations) => {
      if (isTabletDevice && isTabletDetailView) {
        return;
      }
      setSelectedHeaderTab(tab);
      setTimeout(async () => {
        await backgroundApiProxy.serviceSetting.setSelectedBrowserTab(tab);
      }, 150);
    },
    [isTabletDetailView, isTabletDevice],
  );
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
    if (isTabletDevice) {
      return;
    }
    const listener = (event: { tab: ETranslations }) => {
      void handleChangeHeaderTab(event.tab);
    };
    appEventBus.on(EAppEventBusNames.SwitchDiscoveryTabInNative, listener);
    return () => {
      appEventBus.off(EAppEventBusNames.SwitchDiscoveryTabInNative, listener);
    };
  }, [handleChangeHeaderTab, isTabletDevice]);

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
    platformEnv.isNativeIOS ? 143 : 92,
  );
  const handleTabPageLayout = useCallback((e: LayoutChangeEvent) => {
    // Use the actual measured height without arbitrary adjustments
    const height = e.nativeEvent.layout.height - 20;
    setTabPageHeight(height);
  }, []);

  if (isTabletDetailView && displayHomePage) {
    return <TabletHomeContainer />;
  }

  const showDiscoveryPage =
    displayHomePage || (isTabletDevice && !isTabletDetailView);
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
            <Freeze freeze={showDiscoveryPage}>{content}</Freeze>
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
        {!isTabletDetailView ? (
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
          top={-20}
          left={0}
          bg="$bgApp"
          pt="$5"
          width="100%"
          onLayout={handleTabPageLayout}
        >
          <TabPageHeader
            sceneName={EAccountSelectorSceneName.home}
            tabRoute={ETabRoutes.Discovery}
            selectedHeaderTab={selectedHeaderTab}
            onSelectHeaderTab={handleChangeHeaderTab}
          />
        </YStack>
      ) : null}
    </Page>
  );
}

export default memo(withBrowserProvider(MobileBrowser));
