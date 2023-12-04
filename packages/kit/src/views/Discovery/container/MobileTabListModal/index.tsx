import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';
// TODO：需要替换为组件库中的 ListView
import { FlatList, StyleSheet } from 'react-native';

import type { IListViewRef } from '@onekeyhq/components';
import {
  ActionList,
  BlurView,
  Button,
  IconButton,
  ListView,
  Page,
  Stack,
  Toast,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import {
  useBrowserBookmarkAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';

import MobileTabListItem from '../../components/MobileTabListItem';
import MobileTabListPinnedItem from '../../components/MobileTabListItem/MobileTabListPinnedItem';
import { TAB_LIST_CELL_COUNT_PER_ROW } from '../../config/TabList.constants';
import useBrowserOptionsAction from '../../hooks/useBrowserOptionsAction';
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

function TabToolBar({
  closeAllDisabled,
  onAddTab,
  onCloseAll,
  onDone,
}: {
  closeAllDisabled: boolean;
  onAddTab: () => void;
  onCloseAll: () => void;
  onDone: () => void;
}) {
  const intl = useIntl();
  return (
    <Stack
      py="$2"
      flexDirection="row"
      alignItems="center"
      borderTopWidth={StyleSheet.hairlineWidth}
      borderTopColor="$borderSubdued"
    >
      <Stack flex={1} alignItems="center" justifyContent="center">
        <Button
          variant="tertiary"
          size="medium"
          onPress={onCloseAll}
          disabled={closeAllDisabled}
        >
          {intl.formatMessage({ id: 'action__close_all_tabs' })}
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
          {intl.formatMessage({ id: 'action__done' })}
        </Button>
      </Stack>
    </Stack>
  );
}

function MobileTabListModal() {
  const intl = useIntl();
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
    closeAllWebTabs,
    setCurrentWebTab,
    closeWebTab,
    setPinnedTab,
    setDisplayHomePage,
  } = useBrowserTabActions();

  const triggerCloseTab = useRef(false);
  useEffect(() => {
    if (triggerCloseTab.current && !tabs.length) {
      setDisplayHomePage(true);
      navigation.pop();
    }
    triggerCloseTab.current = false;
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
      Toast.success({
        title: bookmark
          ? intl.formatMessage({ id: 'msg__bookmark_added' })
          : intl.formatMessage({ id: 'msg__bookmark_removed' }),
      });
    },
    [addBrowserBookmark, removeBrowserBookmark, intl],
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
      Toast.success({
        title: pinned
          ? intl.formatMessage({ id: 'msg__pinned' })
          : intl.formatMessage({ id: 'msg__unpinned' }),
      });
    },
    [setPinnedTab, intl],
  );
  const handleCloseTab = useCallback(
    (id: string) => {
      triggerCloseTab.current = true;
      void closeWebTab(id);
    },
    [closeWebTab],
  );

  const handleAddNewTab = useCallback(() => {
    if (disabledAddedNewTab) {
      Toast.message({
        title: intl.formatMessage(
          { id: 'msg__tab_has_reached_the_maximum_limit_of_str' },
          { 0: '20' },
        ),
      });
      return;
    }
    // TODO: need to add promise api for navigation chains
    navigation.pop();
    setTimeout(() => {
      navigation.pushModal(EModalRoutes.DiscoveryModal, {
        screen: EDiscoveryModalRoutes.FakeSearchModal,
      });
    }, 0);
  }, [disabledAddedNewTab, navigation, intl]);

  const showTabOptions = useCallback(
    (tab: IWebTab, id: string) => {
      ActionList.show({
        title: 'Options',
        sections: [
          {
            items: [
              {
                label: intl.formatMessage({
                  id: tab.isBookmark
                    ? 'actionn__remove_bookmark'
                    : 'actionn__bookmark',
                }),
                icon: tab.isBookmark ? 'StarSolid' : 'StarOutline',
                onPress: () =>
                  handleBookmarkPress(
                    !tab.isBookmark,
                    tab.url,
                    tab.title ?? '',
                  ),
              },
              {
                label: intl.formatMessage({
                  id: tab.isPinned ? 'action__unpin' : 'action__pin',
                }),
                icon: tab.isPinned ? 'ThumbtackSolid' : 'ThumbtackOutline',
                onPress: () => handlePinnedPress(id, !tab.isPinned),
              },
              {
                label: intl.formatMessage({ id: 'action__share' }),
                icon: 'ShareOutline',
                onPress: () => handleShare(tab.url),
              },
            ],
          },
          {
            items: [
              {
                label: intl.formatMessage({
                  id: tab.isPinned
                    ? 'action__close_pin_tab'
                    : 'form__close_tab',
                }),
                icon: 'CrossedLargeOutline',
                onPress: () => handleCloseTab(id),
              },
            ],
          },
        ],
      });
    },
    [handleBookmarkPress, handlePinnedPress, handleShare, handleCloseTab, intl],
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
        left="$2.5"
        bottom="$2.5"
        right="$2.5"
        borderRadius="$5"
        bg="$bgStrong"
      >
        <ListView
          contentContainerStyle={{
            p: '$1',
          }}
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
        title={intl.formatMessage(
          { id: 'title__str_tabs' },
          { 0: `${tabs.length ?? 0}` },
        )}
      />
      <Page.Body>
        <FlatList
          ref={flatListRef}
          data={data}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={TAB_LIST_CELL_COUNT_PER_ROW}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 10,
            paddingBottom: 62,
          }}
        />
        {renderPinnedList}
      </Page.Body>
      <Page.Footer>
        <TabToolBar
          closeAllDisabled={data.length <= 0}
          onAddTab={handleAddNewTab}
          onCloseAll={() => {
            triggerCloseTab.current = true;
            closeAllWebTabs();
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
