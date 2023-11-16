import { useMemo, useState } from 'react';

import { Image } from 'react-native';

import { ActionList, Icon, Stack, Text, XStack } from '@onekeyhq/components';

import { useWebTabData } from '../../hooks/useWebTabs';

function DesktopCustomTabBarItem({
  id,
  activeTabId,
  onPress,
  onBookmarkPress,
  onPinnedPress,
  onClose,
}: {
  id: string;
  activeTabId: string | null;
  onPress: (id: string) => void;
  onBookmarkPress: (bookmark: boolean, url: string, title: string) => void;
  onPinnedPress: (id: string, pinned: boolean) => void;
  onClose: (id: string) => void;
}) {
  const { tab } = useWebTabData(id);
  const [menuHoverVisible, setMenuHoverVisible] = useState(false);
  const [open, onOpenChange] = useState(false);
  const isActive = useMemo(() => activeTabId === id, [activeTabId, id]);
  return (
    <XStack
      key={id}
      flexDirection="row"
      alignItems="center"
      py="$1.5"
      px="$2"
      h="$8"
      borderRadius="$2"
      space="$2"
      bg={isActive ? '$bgActive' : undefined}
      onPress={() => onPress(id)}
      // @ts-expect-error
      onContextMenu={(event) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        event.preventDefault();
        console.log('===> onContextMenu: ');
      }}
    >
      <Stack p="$0.5">
        {tab?.favicon && (
          <Image
            style={{ width: 16, height: 16 }}
            source={{ uri: tab?.favicon }}
          />
        )}
      </Stack>
      <XStack
        flex={1}
        onHoverIn={() => setMenuHoverVisible(true)}
        onHoverOut={() => setMenuHoverVisible(false)}
        alignItems="center"
      >
        <Text variant="$bodyMd" numberOfLines={1} flex={1}>
          {tab.title}
        </Text>
        <ActionList
          open={open}
          title="Action List"
          renderTrigger={
            menuHoverVisible && (
              <Stack
                p="$1"
                onPress={() => {
                  onOpenChange(true);
                }}
                pressStyle={{
                  borderRadius: '$full',
                  backgroundColor: '$bgActive',
                }}
              >
                <Icon name="DotHorOutline" />
              </Stack>
            )
          }
          sections={[
            {
              items: [
                {
                  label: tab.isBookmark ? 'Delete Bookmark' : 'Bookmark',
                  icon: tab.isBookmark ? 'BookmarkSolid' : 'BookmarkOutline',
                  onPress: () => {
                    onBookmarkPress(!tab.isBookmark, tab.url, tab.title ?? '');
                    onOpenChange(false);
                  },
                },
                {
                  label: tab.isPinned ? 'Un-Pin' : 'Pin',
                  icon: tab.isPinned ? 'ThumbtackSolid' : 'ThumbtackOutline',
                  onPress: () => {
                    onPinnedPress(tab.id, !tab.isPinned);
                    onOpenChange(false);
                  },
                },
              ],
            },
            {
              items: [
                {
                  label: tab.isPinned ? 'Close Pin Tab' : 'Close Tab',
                  icon: 'CrossedLargeOutline',
                  onPress: () => {
                    onClose(id);
                    onOpenChange(false);
                  },
                },
              ],
            },
          ]}
        />
      </XStack>
    </XStack>
  );
}

export default DesktopCustomTabBarItem;
