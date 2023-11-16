import { memo, useCallback, useMemo } from 'react';

import { Divider, Icon, Stack, Text, XStack } from '@onekeyhq/components';

import DesktopCustomTabBarItem from '../../components/DesktopCustomTabBarItem';
import useBrowserBookmarkAction from '../../hooks/useBrowserBookmarkAction';
import useWebTabAction from '../../hooks/useWebTabAction';
import { useActiveTabId, useWebTabs } from '../../hooks/useWebTabs';
import { withBrowserProvider } from '../Browser/WithBrowserProvider';

function AddTabButton({ onAddTab }: { onAddTab: () => void }) {
  return (
    <XStack
      key="AddTabButton"
      flexDirection="row"
      alignItems="center"
      py="$1.5"
      px="$2"
      h="$8"
      borderRadius="$2"
      space="$2"
      onPress={onAddTab}
      hoverStyle={{
        bg: '$bgActive',
      }}
    >
      <Icon name="PlusSmallOutline" size="$5" />
      <Text variant="$bodyMd" numberOfLines={1} flex={1}>
        New Tab
      </Text>
    </XStack>
  );
}

function DesktopCustomTabBar() {
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const { setCurrentWebTab, closeWebTab, setPinnedTab, addBlankWebTab } =
    useWebTabAction();
  const { addBrowserBookmark, removeBrowserBookmark } =
    useBrowserBookmarkAction();
  const data = useMemo(() => (tabs ?? []).filter((t) => !t.isPinned), [tabs]);
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
        addBrowserBookmark({ url, title });
      } else {
        removeBrowserBookmark(url);
      }
    },
    [addBrowserBookmark, removeBrowserBookmark],
  );

  return (
    <Stack>
      {pinnedData.map((t) => (
        <DesktopCustomTabBarItem
          id={t.id}
          activeTabId={activeTabId}
          onPress={(id) => {
            setCurrentWebTab(id);
          }}
          onBookmarkPress={handleBookmarkPress}
          onPinnedPress={handlePinnedPress}
          onClose={handleCloseTab}
        />
      ))}
      {pinnedData.length > 0 && <Divider m="$1.5" />}
      <AddTabButton onAddTab={() => addBlankWebTab()} />
      {data.map((t) => (
        <DesktopCustomTabBarItem
          id={t.id}
          activeTabId={activeTabId}
          onPress={(id) => {
            setCurrentWebTab(id);
          }}
          onBookmarkPress={handleBookmarkPress}
          onPinnedPress={handlePinnedPress}
          onClose={handleCloseTab}
        />
      ))}
    </Stack>
  );
}

export default memo(withBrowserProvider(DesktopCustomTabBar));
