import { useCallback, useEffect, useMemo, useState } from 'react';

import { FlatList, StyleSheet } from 'react-native';

import {
  BlurView,
  Button,
  IconButton,
  ListView,
  Stack,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../../routes/Root/Modal/Routes';
import MobileTabListItem from '../../components/MobileTabListItem';
import MobileTabItemOptions from '../../components/MobileTabListItem/MobileTabItemOptions';
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

  const [showOptionsList, setShowOptionsList] = useState(false);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);

  const handleBookmarkPress = useCallback(
    (bookmark: boolean, url: string, title: string) => {
      if (bookmark) {
        addBrowserBookmark({ url, title });
      } else {
        removeBrowserBookmark(url);
      }
      setShowOptionsList(false);
    },
    [addBrowserBookmark, removeBrowserBookmark],
  );
  const handleShare = useCallback(
    (url: string) => {
      handleShareUrl(url, () => setShowOptionsList(false));
    },
    [handleShareUrl],
  );
  const handlePinnedPress = useCallback(
    (id: string, pinned: boolean) => {
      void setPinnedTab({ id, pinned });
      setShowOptionsList(false);
    },
    [setPinnedTab],
  );
  const handleCloseTab = useCallback(
    (id: string) => {
      void closeWebTab(id);
      setShowOptionsList(false);
    },
    [closeWebTab],
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
          setSelectedTabId(id);
          setShowOptionsList(true);
        }}
      />
    ),
    [navigation, setCurrentWebTab, activeTabId, handleCloseTab],
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
          setSelectedTabId(id);
          setShowOptionsList(true);
        }}
      />
    ),
    [navigation, setCurrentWebTab, activeTabId, handleCloseTab],
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
    <ModalContainer onConfirm={() => {}} onCancel={() => closeAllWebTab()}>
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
      <MobileTabItemOptions
        id={selectedTabId}
        onBookmarkPress={handleBookmarkPress}
        onPinnedPress={handlePinnedPress}
        onShare={handleShare}
        onClose={handleCloseTab}
      />
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
    </ModalContainer>
  );
}

export default withBrowserProvider(MobileTabListModal);
