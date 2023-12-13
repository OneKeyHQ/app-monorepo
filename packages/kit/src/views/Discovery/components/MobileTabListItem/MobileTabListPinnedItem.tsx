import { useMemo } from 'react';

import { Avatar, Icon, Stack, Text, XStack } from '@onekeyhq/components';

import { useWebTabDataById } from '../../hooks/useWebTabs';

import type { IWebTab } from '../../types';

function MobileTabListPinnedItem({
  id,
  activeTabId,
  onSelectedItem,
  onLongPress,
}: {
  activeTabId: string | null;
  onSelectedItem: (id: string) => void;
  onCloseItem: (id: string) => void;
  onLongPress: (id: string) => void;
} & IWebTab) {
  const { tab } = useWebTabDataById(id);
  const isActive = useMemo(() => activeTabId === id, [id, activeTabId]);
  return (
    <Stack
      flex={1}
      p="$0.5"
      minWidth="$28"
      maxWidth="$40"
      borderRadius="$4"
      borderWidth={4}
      borderColor={isActive ? '$focusRing' : '$transparent'}
      marginHorizontal={2}
      onPress={() => {
        onSelectedItem(id);
      }}
      onLongPress={() => {
        onLongPress(id);
      }}
      animation="quick"
      pressStyle={{
        scale: 0.95,
      }}
    >
      <XStack
        bg="$bgStrong"
        p="$2"
        alignItems="center"
        borderRadius="$2.5"
        testID={`tab-list-stack-pinned-${id}`}
      >
        <Avatar size="$4" borderRadius="$1">
          <Avatar.Image src={tab?.favicon} />
          <Avatar.Fallback>
            <Icon name="GlobusOutline" size="$4" />
          </Avatar.Fallback>
        </Avatar>
        <Text flex={1} variant="$bodySm" numberOfLines={1} ml="$2">
          {tab?.title || ''}
        </Text>
      </XStack>
    </Stack>
  );
}

export default MobileTabListPinnedItem;
