import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

// TODO：需要替换为组件库中的 ListView
import { FlatList, InteractionManager, StyleSheet } from 'react-native';

import type { IListViewRef } from '@onekeyhq/components';
import {
  ActionList,
  BlurView,
  Button,
  IconButton,
  ListView,
  Page,
  Stack,
  Text,
  Toast,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../../routes/Root/Modal/Routes';
import MobileTabListItem from '../../components/MobileTabListItem';
import MobileTabListPinnedItem from '../../components/MobileTabListItem/MobileTabListPinnedItem';
import { TAB_LIST_CELL_COUNT_PER_ROW } from '../../config/TabList.constants';
import useBrowserBookmarkAction from '../../hooks/useBrowserBookmarkAction';
import useBrowserOptionsAction from '../../hooks/useBrowserOptionsAction';
import useWebTabAction from '../../hooks/useWebTabAction';
import {
  useActiveTabId,
  useDisabledAddedNewTab,
  useWebTabs,
} from '../../hooks/useWebTabs';
import {
  EDiscoveryModalRoutes,
  type IDiscoveryModalParamList,
} from '../../router/Routes';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

import type { IWebTab } from '../../types';
import type { View } from 'react-native';

export const tabGridRefs: Record<string, View> = {};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  listContentContainer: {
    paddingBottom: 16,
  },
});

function TabToolBar({
  onAddTab,
  onCloseAll,
  onDone,
}: {
  onAddTab: () => void;
  onCloseAll: () => void;
  onDone: () => void;
}) {
  return (
    <Stack py="$2" flexDirection="row" alignItems="center">
      <Stack flex={1} alignItems="center" justifyContent="center">
        <Button variant="tertiary" size="medium" onPress={onCloseAll}>
          Close All
        </Button>
      </Stack>
      <Stack flex={1} alignItems="center" justifyContent="center">
        <IconButton
          variant="secondary"
          size="medium"
          icon="PlusLargeOutline"
          onPress={onAddTab}
        />
      </Stack>
      <Stack flex={1} alignItems="center" justifyContent="center">
        <Button variant="tertiary" size="medium" onPress={onDone}>
          Done
        </Button>
      </Stack>
    </Stack>
  );
}

function HeaderTitle({ children }: PropsWithChildren<unknown>) {
  return <Text>{children} Tabs</Text>;
}

function MobileTabListModal() {
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();
  const { tabs } = useWebTabs();
  const data = useMemo(() => (tabs ?? []).filter((t) => !t.isPinned), [tabs]);
  const pinnedData = useMemo(
    () => (tabs ?? []).filter((t) => t.isPinned),
    [tabs],
  );
  const { disabledAddedNewTab } = useDisabledAddedNewTab();

  const { activeTabId } = useActiveTabId();

  const { addBrowserBookmark, removeBrowserBookmark } =
    useBrowserBookmarkAction();

  const {
    closeAllWebTab,
    setCurrentWebTab,
    closeWebTab,
    setPinnedTab,
    setDisplayHomePage,
  } = useWebTabAction();

  const triggerCloseAllTab = useRef(false);
  useEffect(() => {
    if (triggerCloseAllTab.current && !tabs.length) {
      setDisplayHomePage(true);
      navigation.pop();
      triggerCloseAllTab.current = false;
    }
  }, [tabs, setDisplayHomePage, navigation]);

  const flatListRef = useRef<FlatList<IWebTab> | null>(null);
  const pinnedListRef = useRef<IListViewRef<IWebTab> | null>(null);

  useEffect(() => {
    // wait for flatListRef.current to be ready
    setTimeout(
      () => {
        if (!flatListRef.current) return;
        const index = data.findIndex((t) => t.id === activeTabId);
        if (index === -1) return;
        flatListRef.current.scrollToIndex({
          index: Math.floor(index / TAB_LIST_CELL_COUNT_PER_ROW),
          animated: false,
          viewPosition: 0,
        });
      },
      data.length > 10 ? 300 : 200,
    );
  }, [activeTabId, data]);

  useEffect(() => {
    // wait for pinnedListRef.current to be ready
    setTimeout(
      () => {
        if (!pinnedListRef.current) return;
        const index = pinnedData.findIndex((t) => t.id === activeTabId);
        if (index === -1) return;
        pinnedListRef.current.scrollToIndex({
          index,
          animated: false,
          viewPosition: 0,
        });
      },
      pinnedData.length > 10 ? 300 : 200,
    );
  }, [activeTabId, pinnedData]);

  const { handleShareUrl } = useBrowserOptionsAction();

  const handleBookmarkPress = useCallback(
    (bookmark: boolean, url: string, title: string) => {
      if (bookmark) {
        addBrowserBookmark({ url, title });
      } else {
        removeBrowserBookmark(url);
      }
      Toast.success({ title: bookmark ? 'Bookmark Added' : 'Remove Success' });
    },
    [addBrowserBookmark, removeBrowserBookmark],
  );
  const handleShare = useCallback(
    (url: string) => {
      handleShareUrl(url);
    },
    [handleShareUrl],
  );
  const handlePinnedPress = useCallback(
    (id: string, pinned: boolean) => {
      void setPinnedTab({ id, pinned });
      Toast.success({ title: pinned ? 'Pin Success' : 'UnPin Success' });
    },
    [setPinnedTab],
  );
  const handleCloseTab = useCallback(
    (id: string) => closeWebTab(id),
    [closeWebTab],
  );

  const handleAddNewTab = useCallback(() => {
    if (disabledAddedNewTab) {
      Toast.message({ title: '窗口已达 20 个上限' });
      return;
    }
    // TODO: need to add promise  api for navigation chains
    navigation.pop();
    setTimeout(() => {
      navigation.pushModal(EModalRoutes.DiscoveryModal, {
        screen: EDiscoveryModalRoutes.FakeSearchModal,
      });
    }, 0);
  }, [disabledAddedNewTab, navigation]);

  const showTabOptions = useCallback(
    (tab: IWebTab, id: string) => {
      ActionList.show({
        title: 'Options',
        sections: [
          {
            items: [
              {
                label: tab.isBookmark ? 'Delete Bookmark' : 'Bookmark',
                icon: tab.isBookmark ? 'BookmarkSolid' : 'BookmarkOutline',
                onPress: () =>
                  handleBookmarkPress(
                    !tab.isBookmark,
                    tab.url,
                    tab.title ?? '',
                  ),
              },
              {
                label: tab.isPinned ? 'Un-Pin' : 'Pin',
                icon: tab.isPinned ? 'PinSolid' : 'PinOutline',
                onPress: () => handlePinnedPress(id, !tab.isPinned),
              },
              {
                label: 'Share',
                icon: 'ShareOutline',
                onPress: () => handleShare(tab.url),
              },
            ],
          },
          {
            items: [
              {
                label: tab.isPinned ? 'Close Pin Tab' : 'Close Tab',
                icon: 'CrossedLargeOutline',
                onPress: () => handleCloseTab(id),
              },
            ],
          },
        ],
      });
    },
    [handleBookmarkPress, handlePinnedPress, handleShare, handleCloseTab],
  );

  const keyExtractor = useCallback((item: IWebTab) => item.id, []);
  const renderItem = useCallback(
    ({ item: tab }: { item: IWebTab }) => (
      <MobileTabListItem
        {...tab}
        activeTabId={activeTabId}
        onSelectedItem={(id) => {
          setCurrentWebTab(id);
          navigation.pop();
        }}
        onCloseItem={handleCloseTab}
        onLongPress={(id) => {
          showTabOptions(tab, id);
        }}
      />
    ),
    [activeTabId, handleCloseTab, setCurrentWebTab, navigation, showTabOptions],
  );

  const renderPinnedItem = useCallback(
    ({ item: tab }: { item: IWebTab }) => (
      <MobileTabListPinnedItem
        {...tab}
        activeTabId={activeTabId}
        onSelectedItem={(id) => {
          setCurrentWebTab(id);
          navigation.pop();
        }}
        onCloseItem={handleCloseTab}
        onLongPress={(id) => {
          showTabOptions(tab, id);
        }}
      />
    ),
    [navigation, setCurrentWebTab, activeTabId, handleCloseTab, showTabOptions],
  );

  const renderPinnedList = useMemo(() => {
    if (pinnedData.length === 0) {
      return null;
    }
    return (
      <BlurView
        position="absolute"
        left={10}
        bottom={0}
        right={10}
        bg="$bgStrong"
        px="$2"
        py="$3"
        borderRadius="$5"
        display="flex"
        flexDirection="row"
        alignItems="center"
      >
        <ListView
          w="100%"
          ref={pinnedListRef}
          horizontal
          data={pinnedData}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          estimatedItemSize="$28"
          renderItem={renderPinnedItem}
        />
      </BlurView>
    );
  }, [pinnedData, renderPinnedItem]);

  return (
    <Page>
      <Page.Header
        headerTitle={HeaderTitle}
        title={(tabs.length ?? 0).toString()}
      />
      <Page.Body>
        <Stack style={styles.container}>
          <FlatList
            ref={flatListRef}
            data={data}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={TAB_LIST_CELL_COUNT_PER_ROW}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContentContainer}
          />
        </Stack>
        {renderPinnedList}
      </Page.Body>
      <Page.Footer>
        <TabToolBar
          onAddTab={handleAddNewTab}
          onCloseAll={() => {
            triggerCloseAllTab.current = true;
            void closeAllWebTab();
          }}
          onDone={() => {
            navigation.pop();
          }}
        />
      </Page.Footer>
    </Page>
  );
}

export default withBrowserProvider(MobileTabListModal);
