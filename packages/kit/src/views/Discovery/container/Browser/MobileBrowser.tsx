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

import { HandleRebuildBrowserData } from '../../components/HandleData/HandleRebuildBrowserTabData';
import MobileBrowserBottomBar from '../../components/MobileBrowser/MobileBrowserBottomBar';
import MobileBrowserInfoBar from '../../components/MobileBrowser/MobileBrowserInfoBar';
import {
  BROWSER_BOTTOM_BAR_HEIGHT,
  DISPLAY_BOTTOM_BAR_DURATION,
  IGNORE_INITIAL_EVENT_COUNT,
  MAX_OPACITY_BOTTOM_BAR,
  THROTTLE_TIME,
  THROTTLE_TIME_WHEN_REACH_BOTTOM,
} from '../../config/Animation.constants';
import useWebTabAction from '../../hooks/useWebTabAction';
import {
  useActiveTabId,
  useDisplayHomePageFlag,
  useWebTabData,
  useWebTabs,
} from '../../hooks/useWebTabs';
import { EDiscoveryModalRoutes } from '../../router/Routes';
import { checkAndCreateFolder } from '../../utils/screenshot';
import Dashboard from '../Dashboard';

import MobileBrowserContent from './MobileBrowserContent';
import { withBrowserProvider } from './WithBrowserProvider';

import type { IDiscoveryModalParamList } from '../../router/Routes';
import type { WebViewScrollEvent } from 'react-native-webview/lib/WebViewTypes';

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

  const toolbarHeight = useSharedValue(BROWSER_BOTTOM_BAR_HEIGHT);
  const toolbarOpacity = useSharedValue(MAX_OPACITY_BOTTOM_BAR);
  const lastScrollY = useRef(0); // Keep track of the last scroll position
  const lastScrollEventTimeRef = useRef(0);
  const initialEventsCounterRef = useRef(0);

  const handleScroll = useCallback(
    ({ nativeEvent }: WebViewScrollEvent) => {
      const { contentSize, contentOffset, layoutMeasurement } = nativeEvent;
      const contentOffsetY = contentOffset.y;
      let throttleTime = THROTTLE_TIME;

      // Reached bottom of the page
      if (
        contentOffset.y + layoutMeasurement.height >=
        contentSize.height - BROWSER_BOTTOM_BAR_HEIGHT
      ) {
        throttleTime = THROTTLE_TIME_WHEN_REACH_BOTTOM;
      }

      const now = Date.now();
      if (now - lastScrollEventTimeRef.current < throttleTime) {
        if (initialEventsCounterRef.current > IGNORE_INITIAL_EVENT_COUNT) {
          return;
        }
        initialEventsCounterRef.current += 1;
      }

      lastScrollEventTimeRef.current = now;

      // console.log('Common Scroll Logic');
      // Determine the direction of the scroll
      const isScrollingDown = contentOffsetY < lastScrollY.current;
      lastScrollY.current = contentOffsetY;

      const height = isScrollingDown
        ? BROWSER_BOTTOM_BAR_HEIGHT
        : Math.min(
            BROWSER_BOTTOM_BAR_HEIGHT,
            Math.max(0, BROWSER_BOTTOM_BAR_HEIGHT - contentOffsetY),
          );

      toolbarHeight.value = withTiming(height, {
        duration: DISPLAY_BOTTOM_BAR_DURATION,
      }); // No gradual animation
      toolbarOpacity.value = withTiming(height / BROWSER_BOTTOM_BAR_HEIGHT, {
        duration: DISPLAY_BOTTOM_BAR_DURATION,
      }); // No gradual animation
    },
    [toolbarHeight, toolbarOpacity],
  );
  const toolbarAnimatedStyle = useAnimatedStyle(() => ({
    height: toolbarHeight.value,
    opacity: toolbarOpacity.value,
  }));

  // Reset toolbar animation state when activeTabId changes.
  useEffect(() => {
    toolbarHeight.value = withTiming(BROWSER_BOTTOM_BAR_HEIGHT);
    toolbarOpacity.value = withTiming(MAX_OPACITY_BOTTOM_BAR);
    initialEventsCounterRef.current = 0;
    lastScrollEventTimeRef.current = 0;
    lastScrollY.current = 0;
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
      <HandleRebuildBrowserData />
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
              screen: EDiscoveryModalRoutes.FakeSearchModal,
            });
          }}
        />
      )}
      <Freeze freeze={displayHomePage}>{content}</Freeze>
      <Freeze freeze={!displayBottomBar}>
        <Animated.View
          style={[
            toolbarAnimatedStyle,
            {
              position: 'absolute',
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
  );
}

export default memo(withBrowserProvider(MobileBrowser));
