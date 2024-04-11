import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { Freeze } from 'react-freeze';
import Animated from 'react-native-reanimated';

import {
  Icon,
  Page,
  Stack,
  XStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IDiscoveryModalParamList } from '@onekeyhq/shared/src/routes';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import CustomHeaderTitle from '../../components/CustomHeaderTitle';
import { HandleRebuildBrowserData } from '../../components/HandleData/HandleRebuildBrowserTabData';
import HeaderRightToolBar from '../../components/HeaderRightToolBar';
import MobileBrowserBottomBar from '../../components/MobileBrowser/MobileBrowserBottomBar';
import { useDAppNotifyChanges } from '../../hooks/useDAppNotifyChanges';
import useMobileBottomBarAnimation from '../../hooks/useMobileBottomBarAnimation';
import {
  useActiveTabId,
  useDisplayHomePageFlag,
  useWebTabs,
} from '../../hooks/useWebTabs';
import { checkAndCreateFolder } from '../../utils/screenshot';
import DashboardContent from '../Dashboard/DashboardContent';

import MobileBrowserContent from './MobileBrowserContent';
import { withBrowserProvider } from './WithBrowserProvider';

function MobileBrowser() {
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const { closeWebTab, setCurrentWebTab } = useBrowserTabActions().current;
  // const { tab } = useWebTabDataById(activeTabId ?? '');
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();
  const { handleScroll, toolbarRef, toolbarAnimatedStyle } =
    useMobileBottomBarAnimation(activeTabId);
  useDAppNotifyChanges({ tabId: activeTabId });

  const { displayHomePage } = useDisplayHomePageFlag();

  const displayBottomBar = useMemo(() => {
    if (!displayHomePage) return true;
    if (displayHomePage && tabs.length > 0) return true;
    return false;
  }, [displayHomePage, tabs]);

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

  const closeCurrentWebTab = useCallback(
    async () => (activeTabId ? closeWebTab(activeTabId) : Promise.resolve()),
    [activeTabId, closeWebTab],
  );

  const onCloseCurrentWebTabAndGoHomePage = useCallback(() => {
    if (activeTabId) {
      closeWebTab(activeTabId);
      setCurrentWebTab(null);
    }
    return Promise.resolve();
  }, [activeTabId, closeWebTab, setCurrentWebTab]);

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
      navigation.pushFullModal(EModalRoutes.DiscoveryModal, {
        screen: EDiscoveryModalRoutes.SearchModal,
        params: {
          url,
          tabId: activeTabId ?? undefined,
          useCurrentWindow: !!activeTabId,
        },
      });
    },
    [navigation, activeTabId],
  );

  const { top } = useSafeAreaInsets();

  return (
    <Page skipLoading={platformEnv.isNativeIOS}>
      <Page.Header headerShown={false} />
      {/* custom header */}
      <XStack
        pt={top}
        mx="$5"
        alignItems="center"
        my="$1"
        mt={platformEnv.isNativeAndroid ? '$3' : undefined}
      >
        {!displayHomePage ? (
          <Stack onPress={onCloseCurrentWebTabAndGoHomePage}>
            <Icon name="CrossedLargeOutline" mr="$4" />
          </Stack>
        ) : null}
        <CustomHeaderTitle handleSearchBarPress={handleSearchBarPress} />
        <HeaderRightToolBar />
      </XStack>
      <Page.Body>
        <Stack flex={1} zIndex={3}>
          <HandleRebuildBrowserData />
          <Stack flex={1}>
            <Freeze freeze={!displayHomePage}>
              <DashboardContent onScroll={handleScroll} />
            </Freeze>
            <Freeze freeze={displayHomePage}>{content}</Freeze>
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
              <MobileBrowserBottomBar id={activeTabId ?? ''} />
            </Animated.View>
          </Freeze>
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default memo(withBrowserProvider(MobileBrowser));
