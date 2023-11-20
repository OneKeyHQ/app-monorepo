import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useNavigation } from '@react-navigation/core';
import { Freeze } from 'react-freeze';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Stack, Text } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Root/Modal/Routes';

import MobileBrowserBottomBar from '../../components/MobileBrowser/MobileBrowserBottomBar';
import MobileBrowserInfoBar from '../../components/MobileBrowser/MobileBrowserInfoBar';
import { useTabDataFromSimpleDb } from '../../hooks/useTabDataFromSimpleDb';
import useWebTabAction from '../../hooks/useWebTabAction';
import {
  useActiveTabId,
  useDisplayHomePageFlag,
  useWebTabData,
  useWebTabs,
} from '../../hooks/useWebTabs';
import { EDiscoveryModalRoutes } from '../../router/Routes';
import { gotoSite } from '../../utils/gotoSite';
import { checkAndCreateFolder } from '../../utils/screenshot';
import Dashboard from '../Dashboard';

import MobileBrowserContent from './MobileBrowserContent';
import { withBrowserProvider } from './WithBrowserProvider';

import type { IDiscoveryModalParamList } from '../../router/Routes';

function HandleRebuildTabBarData() {
  const result = useTabDataFromSimpleDb();
  const { setWebTabs, addBlankWebTab } = useWebTabAction();

  useEffect(() => {
    if (!result.result) return;
    const data = result.result;
    if (data && Array.isArray(data) && data.length > 0) {
      void setWebTabs({ data });
    }
  }, [result.result, addBlankWebTab, setWebTabs]);

  return null;
}

function MobileBrowser() {
  const navigationCore = useNavigation();
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const { tab } = useWebTabData(activeTabId ?? '');
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();

  const { displayHomePage } = useDisplayHomePageFlag();

  const displayBottomBar = useMemo(() => {
    if (!displayHomePage) return true;
    if (displayHomePage && tabs.length > 0) return true;
    return false;
  }, [displayHomePage, tabs]);

  const { setDisplayHomePage } = useWebTabAction();
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
    console.log('MobileBrowser renderer ===> : ');
    navigationCore.setOptions({
      headerShown: false,
      animation: 'none',
    });
    void checkAndCreateFolder();
  }, [navigationCore]);

  const toolbarHeight = useSharedValue(52);
  const toolbarOpacity = useSharedValue(1);
  const lastScrollY = useRef(0); // Keep track of the last scroll position
  const handleScroll = useCallback(
    (contentOffsetY: number) => {
      // Determine the direction of the scroll
      const isScrollingDown = contentOffsetY < lastScrollY.current;
      lastScrollY.current = contentOffsetY;
      const height = isScrollingDown ? 52 : Math.max(0, 52 - contentOffsetY);
      toolbarHeight.value = withTiming(height, { duration: 100 }); // No gradual animation
      toolbarOpacity.value = withTiming(height / 52, { duration: 100 }); // No gradual animation
    },
    [toolbarHeight, toolbarOpacity],
  );
  const toolbarAnimatedStyle = useAnimatedStyle(() => ({
    height: toolbarHeight.value,
    opacity: toolbarOpacity.value,
  }));

  // Reset toolbar animation state when activeTabId changes.
  useEffect(() => {
    toolbarHeight.value = withTiming(52);
    toolbarOpacity.value = withTiming(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  const content = useMemo(
    () =>
      tabs.map((t) => (
        <MobileBrowserContent id={t.id} key={t.id} onScroll={handleScroll} />
      )),
    [tabs, handleScroll],
  );
  const { top } = useSafeAreaInsets();

  return (
    <Stack flex={1} zIndex={3} pt={top} bg="$bgApp">
      <HandleRebuildTabBarData />
      {displayHomePage ? (
        <Stack flex={1}>
          <Text>Dashboard</Text>
          <Dashboard />
        </Stack>
      ) : (
        <MobileBrowserInfoBar
          id={activeTabId ?? ''}
          url={tab?.url ?? ''}
          onSearch={() => {
            navigation.pushModal(EModalRoutes.DiscoveryModal, {
              screen: EDiscoveryModalRoutes.SearchModal,
              params: {
                onSubmitContent: (text: string) => {
                  console.log('onSubmitContent: ===> : ', text);
                  gotoSite({
                    url: text,
                    isNewWindow: false,
                    userTriggered: true,
                  });
                },
              },
            });
          }}
        />
      )}
      <Freeze freeze={displayHomePage}>{content}</Freeze>
      <Freeze freeze={!displayBottomBar}>
        <Animated.View style={[toolbarAnimatedStyle]}>
          <MobileBrowserBottomBar id={activeTabId ?? ''} />
        </Animated.View>
      </Freeze>
    </Stack>
  );
}

export default memo(withBrowserProvider(MobileBrowser));
