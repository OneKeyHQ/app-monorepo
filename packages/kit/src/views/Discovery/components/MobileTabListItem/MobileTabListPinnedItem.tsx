import { useMemo, useState } from 'react';

import {
  ActionList,
  IconButton,
  Image,
  Stack,
  Text,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { TAB_LIST_CELL_WIDTH } from '../../config/TabList.constants';
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
      p="$2"
      minHeight="$8"
      minWidth="$28"
      maxWidth="$40"
      onPress={() => {
        onSelectedItem(id);
      }}
      onLongPress={() => {
        onLongPress(id);
      }}
      borderRadius="$2"
      bg="$bgStrong"
      overflow="hidden"
      marginHorizontal={6}
    >
      <XStack justifyContent="center" alignItems="center" space="$2">
        <Image w={16} h={16} source={{ uri: tab?.favicon }} />
        <Text flex={1} variant="$bodySm" numberOfLines={1}>
          {tab?.title || ''}
        </Text>
      </XStack>
    </Stack>
  );
}

export default MobileTabListPinnedItem;
