import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { Divider, ScrollView, Stack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import { DesktopTabItem } from '@onekeyhq/components/src/layouts/Navigation/Tab/TabBar/DesktopTabItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { ETabRoutes } from '@onekeyhq/kit/src/routes/Tab/type';
import {
  useBrowserBookmarkAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { HandleRebuildBrowserData } from '@onekeyhq/kit/src/views/Discovery/components/HandleData/HandleRebuildBrowserTabData';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IDiscoveryModalParamList } from '@onekeyhq/shared/src/routes';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import DesktopCustomTabBarItem from '../../components/DesktopCustomTabBarItem';
import { useDesktopNewWindow } from '../../hooks/useDesktopNewWindow';
import { useShortcuts } from '../../hooks/useShortcuts';
import { useActiveTabId, useWebTabs } from '../../hooks/useWebTabs';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import type { ScrollView as RNScrollView } from 'react-native';

function DesktopCustomTabBar() {
  // register desktop shortcuts for browser tab
  useShortcuts();
  // register desktop new window event
  useDesktopNewWindow();

  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const { setCurrentWebTab, closeWebTab, setPinnedTab, closeAllWebTabs } =
    useBrowserTabActions().current;
  const { addBrowserBookmark, removeBrowserBookmark } =
    useBrowserBookmarkAction().current;
  const data = useMemo(() => {
    const unpinnedData = (tabs ?? []).filter((t) => !t.isPinned);
    unpinnedData.reverse();
    return unpinnedData;
  }, [tabs]);
  const pinnedData = useMemo(
    () => (tabs ?? []).filter((t) => t.isPinned),
    [tabs],
  );

  // scroll to top when new tab is added
  const scrollViewRef = useRef<RNScrollView>(null);
  const previousTabsLength = usePrevious(tabs?.length);
  useEffect(() => {
    if (previousTabsLength && tabs?.length > previousTabsLength) {
      scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    }
  }, [previousTabsLength, tabs?.length]);

  const handlePinnedPress = useCallback(
    (id: string, pinned: boolean) => {
      void setPinnedTab({ id, pinned });
    },
    [setPinnedTab],
  );
  const handleCloseTab = useCallback(
    (id: string) => {
      void closeWebTab(id);
    },
    [closeWebTab],
  );
  const handleBookmarkPress = useCallback(
    (bookmark: boolean, url: string, title: string) => {
      if (bookmark) {
        void addBrowserBookmark({ url, title });
      } else {
        void removeBrowserBookmark(url);
      }
    },
    [addBrowserBookmark, removeBrowserBookmark],
  );

  useListenTabFocusState(ETabRoutes.MultiTabBrowser, (isFocus: boolean) => {
    if (!isFocus) {
      setCurrentWebTab('');
    }
  });

  useEffect(() => {
    const listener = () => {
      closeAllWebTabs();
    };
    appEventBus.on(EAppEventBusNames.CloseAllBrowserTab, listener);
    return () => {
      appEventBus.off(EAppEventBusNames.CloseAllBrowserTab, listener);
    };
  }, [closeAllWebTabs]);

  // For risk detection
  useEffect(() => {
    const listener = () => {
      if (activeTabId) {
        handleCloseTab(activeTabId);
      }
    };
    appEventBus.on(EAppEventBusNames.CloseCurrentBrowserTab, listener);
    return () => {
      appEventBus.off(EAppEventBusNames.CloseCurrentBrowserTab, listener);
    };
  }, [handleCloseTab, activeTabId]);

  const onTabPress = useCallback(
    (id: string) => {
      navigation.switchTab(ETabRoutes.MultiTabBrowser);
      setCurrentWebTab(id);
    },
    [setCurrentWebTab, navigation],
  );

  return (
    <Stack flex={1}>
      <HandleRebuildBrowserData />
      {/* Pin Tabs */}
      {pinnedData.map((t) => (
        <DesktopCustomTabBarItem
          id={t.id}
          key={t.id}
          activeTabId={activeTabId}
          onPress={onTabPress}
          onBookmarkPress={handleBookmarkPress}
          onPinnedPress={handlePinnedPress}
          onClose={handleCloseTab}
          testID={`tab-list-stack-pinned-${t.id}`}
        />
      ))}
      {pinnedData.length > 0 ? <Divider m="$1.5" /> : null}
      {/* New Tab */}
      <DesktopTabItem
        key="AddTabButton"
        label="New Tab"
        icon="PlusSmallOutline"
        testID="browser-bar-add"
        onPress={(e) => {
          e.stopPropagation();
          navigation.pushModal(EModalRoutes.DiscoveryModal, {
            screen: EDiscoveryModalRoutes.SearchModal,
          });
        }}
      />
      <ScrollView mx="$-5" px="$5" ref={scrollViewRef}>
        {/* Tabs */}
        {data.map((t) => (
          <DesktopCustomTabBarItem
            key={t.id}
            id={t.id}
            activeTabId={activeTabId}
            onPress={onTabPress}
            onBookmarkPress={handleBookmarkPress}
            onPinnedPress={handlePinnedPress}
            onClose={handleCloseTab}
            testID={`tab-modal-list-item-${t.id}`}
          />
        ))}
      </ScrollView>
    </Stack>
  );
}

export default memo(withBrowserProvider(DesktopCustomTabBar));
