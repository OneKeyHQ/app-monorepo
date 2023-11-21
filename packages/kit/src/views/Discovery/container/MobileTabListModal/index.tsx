import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo } from 'react';

import { FlatList, StyleSheet } from 'react-native';

import {
  ActionList,
  BlurView,
  Button,
  IconButton,
  ListView,
  Page,
  Stack,
  Text,
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
import { useActiveTabId, useWebTabs } from '../../hooks/useWebTabs';
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
    <Stack
      py="$2"
      px="$8"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-between"
    >
      <Button variant="tertiary" size="medium" onPress={onCloseAll}>
        Close All
      </Button>
      <IconButton
        variant="secondary"
        size="medium"
        icon="PlusLargeOutline"
        onPress={onAddTab}
      />
      <Button variant="tertiary" size="medium" onPress={onDone}>
        Done
      </Button>
    </Stack>
  );
}

function HeaderTitle({ children }: PropsWithChildren<unknown>) {
  return useMemo(() => <Text>{children} Tabs</Text>, [children]);
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

  useEffect(() => {
    console.log('MobileTabListModal data changed ===> : ', data);
  }, [data]);
  useEffect(() => {
    console.log('MobileTabListModal pinnedData changed ===> : ', pinnedData);
  }, [pinnedData]);

  const { activeTabId } = useActiveTabId();

  const { addBrowserBookmark, removeBrowserBookmark } =
    useBrowserBookmarkAction();

  const { closeAllWebTab, setCurrentWebTab, closeWebTab, setPinnedTab } =
    useWebTabAction();

  const { handleShareUrl } = useBrowserOptionsAction();

  const handleBookmarkPress = useCallback(
    (bookmark: boolean, url: string, title: string) =>
      bookmark
        ? addBrowserBookmark({ url, title })
        : removeBrowserBookmark(url),
    [addBrowserBookmark, removeBrowserBookmark],
  );
  const handleShare = useCallback(
    (url: string) => {
      handleShareUrl(url);
    },
    [handleShareUrl],
  );
  const handlePinnedPress = useCallback(
    (id: string, pinned: boolean) => setPinnedTab({ id, pinned }),
    [setPinnedTab],
  );
  const handleCloseTab = useCallback(
    (id: string) => closeWebTab(id),
    [closeWebTab],
  );

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
            data={data}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={TAB_LIST_CELL_COUNT_PER_ROW}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.listContentContainer}
          />
        </Stack>
        {renderPinnedList}
      </Page.Body>
      <Page.Footer>
        <TabToolBar
          onAddTab={() => {
            navigation.pop();
            navigation.pushModal(EModalRoutes.DiscoveryModal, {
              screen: EDiscoveryModalRoutes.FakeSearchModal,
            });
          }}
          onCloseAll={() => closeAllWebTab()}
          onDone={() => {
            navigation.pop();
          }}
        />
      </Page.Footer>
    </Page>
  );
}

export default withBrowserProvider(MobileTabListModal);
