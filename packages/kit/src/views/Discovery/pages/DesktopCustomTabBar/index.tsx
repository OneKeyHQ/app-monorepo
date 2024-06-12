import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  ScrollView,
  Stack,
  XStack,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import { DesktopTabItem } from '@onekeyhq/components/src/layouts/Navigation/Tab/TabBar/DesktopTabItem';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useBrowserBookmarkAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { HandleRebuildBrowserData } from '@onekeyhq/kit/src/views/Discovery/components/HandleData/HandleRebuildBrowserTabData';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDiscoveryModalParamList } from '@onekeyhq/shared/src/routes';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import DesktopCustomTabBarItem from '../../components/DesktopCustomTabBarItem';
import { useDesktopNewWindow } from '../../hooks/useDesktopNewWindow';
import { useShortcuts } from '../../hooks/useShortcuts';
import { useActiveTabId, useWebTabs } from '../../hooks/useWebTabs';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import type {
  LayoutChangeEvent,
  ScrollView as RNScrollView,
} from 'react-native';

const ITEM_HEIGHT = 32;
function DesktopCustomTabBar() {
  const intl = useIntl();
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

  const { result, run } = usePromiseResult(async () => {
    const tabsWithConnectedAccount = await Promise.all(
      (tabs ?? []).map(async (tab) => {
        const origin = tab?.url ? new URL(tab.url).origin : null;
        let hasConnectedAccount = false;
        if (origin) {
          const connectedAccounts =
            await backgroundApiProxy.serviceDApp.findInjectedAccountByOrigin(
              origin,
            );
          hasConnectedAccount = (connectedAccounts ?? []).length > 0;
        }
        return { ...tab, hasConnectedAccount };
      }),
    );
    const unpinnedTabs = (tabsWithConnectedAccount ?? []).filter(
      (t) => !t.isPinned,
    );
    unpinnedTabs.reverse();
    const pinnedTabs = (tabsWithConnectedAccount ?? []).filter(
      (t) => t.isPinned,
    );
    return {
      unpinnedTabs,
      pinnedTabs,
    };
  }, [tabs]);

  const data = useMemo(
    () => result?.unpinnedTabs ?? [],
    [result?.unpinnedTabs],
  );
  const pinnedData = useMemo(
    () => result?.pinnedTabs ?? [],
    [result?.pinnedTabs],
  );

  // scroll to bottom when new tab pinned
  const pinnedTabsScrollViewRef = useRef<RNScrollView>(null);
  const previousPinnedTabsLength = usePrevious(pinnedData?.length);
  useEffect(() => {
    if (
      previousPinnedTabsLength &&
      pinnedData?.length > previousPinnedTabsLength
    ) {
      pinnedTabsScrollViewRef.current?.scrollToEnd({ animated: false });
    }
  }, [pinnedData?.length, previousPinnedTabsLength, tabs.length]);

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

  const handleDisconnect = useCallback(
    async (url: string | undefined) => {
      const { origin } = new URL(url ?? '');
      if (origin) {
        await backgroundApiProxy.serviceDApp.disconnectWebsite({
          origin,
          storageType: 'injectedProvider',
        });
        setTimeout(() => run(), 200);
      }
    },
    [run],
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

  // For dApp connection state update
  useEffect(() => {
    const fn = () => setTimeout(() => run(), 200);
    appEventBus.on(EAppEventBusNames.DAppConnectUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.DAppConnectUpdate, fn);
    };
  }, [run]);

  const onTabPress = useCallback(
    (id: string) => {
      navigation.switchTab(ETabRoutes.MultiTabBrowser);
      setCurrentWebTab(id);
    },
    [setCurrentWebTab, navigation],
  );

  const [pinContainerHeight, setPinContainerHeight] = useState<number>(0);
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    setPinContainerHeight(height / 2);
  }, []);

  const pinnedBarHeight = useMemo(() => {
    const pinDataTabsHeight = pinnedData.length * ITEM_HEIGHT;
    return pinContainerHeight < pinDataTabsHeight
      ? pinContainerHeight - (pinContainerHeight % ITEM_HEIGHT)
      : pinDataTabsHeight;
  }, [pinContainerHeight, pinnedData.length]);

  return (
    <Stack flex={1} onLayout={handleLayout}>
      <HandleRebuildBrowserData />
      {/* Pin Tabs */}
      <Stack height={pinnedBarHeight}>
        <ScrollView flex={1} ref={pinnedTabsScrollViewRef}>
          {pinnedData.map((t) => (
            <DesktopCustomTabBarItem
              id={t.id}
              key={t.id}
              activeTabId={activeTabId}
              onPress={onTabPress}
              onBookmarkPress={handleBookmarkPress}
              onPinnedPress={handlePinnedPress}
              onClose={handleCloseTab}
              displayDisconnectOption={t.hasConnectedAccount}
              onDisconnect={handleDisconnect}
              testID={`tab-list-stack-pinned-${t.id}`}
            />
          ))}
        </ScrollView>
      </Stack>
      <XStack ai="center" my="$2">
        <Divider testID="pin-tab-divider" />
        <Button
          ml="$1"
          mr="$.5"
          variant="tertiary"
          size="small"
          color="$textDisabled"
          onPress={closeAllWebTabs}
        >
          {intl.formatMessage({ id: ETranslations.global_clear })}
        </Button>
      </XStack>
      {/* New Tab */}
      <DesktopTabItem
        key="AddTabButton"
        label={intl.formatMessage({ id: ETranslations.explore_new_tab })}
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
            displayDisconnectOption={t.hasConnectedAccount}
            onDisconnect={handleDisconnect}
            testID={`tab-modal-list-item-${t.id}`}
          />
        ))}
      </ScrollView>
    </Stack>
  );
}

export default memo(withBrowserProvider(DesktopCustomTabBar));
