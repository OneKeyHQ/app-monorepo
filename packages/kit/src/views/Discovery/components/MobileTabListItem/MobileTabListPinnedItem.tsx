import { useMemo } from 'react';

import { Image, Stack, Text, XStack } from '@onekeyhq/components';

import { useWebTabData } from '../../hooks/useWebTabs';

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
  const { tab } = useWebTabData(id);
  const isActive = useMemo(() => activeTabId === id, [id, activeTabId]);
  return (
    <Stack
      p="$1"
      minHeight="$8"
      minWidth="$28"
      maxWidth="$40"
      borderRadius="$3"
      borderWidth={2}
      borderColor={isActive ? '$borderActive' : '$transparent'}
      marginHorizontal={2}
      onPress={() => {
        onSelectedItem(id);
      }}
      onLongPress={() => {
        onLongPress(id);
      }}
    >
      <XStack
        bg="$bgStrong"
        p="$2"
        justifyContent="center"
        alignItems="center"
        space="$2"
        borderRadius="$2"
      >
        <Image w={16} h={16} source={{ uri: tab?.favicon }} />
        <Text flex={1} variant="$bodySm" numberOfLines={1}>
          {tab?.title || ''}
        </Text>
      </XStack>
    </Stack>
  );
}

export default MobileTabListPinnedItem;
