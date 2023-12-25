import { memo, useCallback, useEffect, useMemo } from 'react';

import { Divider, ScrollView, Stack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import { DesktopTabItem } from '@onekeyhq/components/src/layouts/Navigation/Tab/TabBar/DesktopTabItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
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

import DesktopCustomTabBarItem from '../../components/DesktopCustomTabBarItem';
import { useShortcuts } from '../../hooks/useShortcuts';
import { useActiveTabId, useWebTabs } from '../../hooks/useWebTabs';
import {
  EDiscoveryModalRoutes,
  type IDiscoveryModalParamList,
} from '../../router/Routes';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

function DesktopCustomTabBar() {
  // register desktop shortcuts for browser tab
  useShortcuts();

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

  return (
    <Stack flex={1}>
      <HandleRebuildBrowserData />
      {/* Pin Tabs */}
      {pinnedData.map((t) => (
        <DesktopCustomTabBarItem
          id={t.id}
          key={t.id}
          activeTabId={activeTabId}
          onPress={(id) => {
            setCurrentWebTab(id);
          }}
          onBookmarkPress={handleBookmarkPress}
          onPinnedPress={handlePinnedPress}
          onClose={handleCloseTab}
          testID={`tab-list-stack-pinned-${t.id}`}
        />
      ))}
      {pinnedData.length > 0 && <Divider m="$1.5" />}
      {/* New Tab */}
      <DesktopTabItem
        key="AddTabButton"
        label="New Tab"
        icon="PlusSmallOutline"
        testID="browser-bar-add"
        onPress={(e) => {
          e.stopPropagation();
          navigation.pushModal(EModalRoutes.DiscoveryModal, {
            screen: EDiscoveryModalRoutes.FakeSearchModal,
          });
        }}
      />
      <ScrollView mx="$-5" px="$5">
        {/* Tabs */}
        {data.map((t) => (
          <DesktopCustomTabBarItem
            key={t.id}
            id={t.id}
            activeTabId={activeTabId}
            onPress={(id) => {
              navigation.switchTab(ETabRoutes.MultiTabBrowser);
              setCurrentWebTab(id);
            }}
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
