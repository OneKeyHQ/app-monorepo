import { useMemo } from 'react';

import {
  IconButton,
  Image,
  Stack,
  Text,
  XStack,
  YStack,
} from '@onekeyhq/components';

import {
  TAB_LIST_CELL_HEIGHT,
  TAB_LIST_CELL_WIDTH,
  THUMB_HEIGHT,
  THUMB_WIDTH,
} from '../../config/TabList.constants';
import { useWebTabData } from '../../hooks/useWebTabs';

import type { IWebTab } from '../../types';

function MobileTabListItem({
  id,
  activeTabId,
  onSelectedItem,
  onCloseItem,
  onLongPress,
}: IWebTab & {
  activeTabId: string | null;
  onSelectedItem: (id: string) => void;
  onCloseItem: (id: string) => void;
  onLongPress: (id: string) => void;
}) {
  const { tab } = useWebTabData(id);
  const isActive = useMemo(() => activeTabId === id, [id, activeTabId]);
  return (
    <Stack
      w={TAB_LIST_CELL_WIDTH}
      h={TAB_LIST_CELL_HEIGHT}
      mr="$4"
      mb="$4"
      onPress={() => {
        onSelectedItem(id);
      }}
      onLongPress={() => {
        onLongPress(id);
      }}
      borderRadius="$3"
      borderWidth={1}
      borderColor={isActive ? '$borderActive' : '$borderCritical'}
      bg="$background-default"
      overflow="hidden"
    >
      <YStack
        flex={1}
        collapsable={false}
        justifyContent="center"
        alignItems="center"
      >
        <XStack justifyContent="center" alignItems="center" h="$8">
          <Image w="$4" h="$4" source={{ uri: tab?.favicon }} />
          <Text
            px="$2"
            flex={1}
            color="$text"
            textAlign="left"
            numberOfLines={1}
          >
            {tab?.title || ''}
          </Text>
        </XStack>
        <Image
          w={THUMB_WIDTH}
          h={THUMB_HEIGHT}
          source={{ uri: tab?.thumbnail }}
        />
        <IconButton
          mb="$2"
          w="$8"
          h="$8"
          size="small"
          variant="primary"
          icon="CrossedSmallOutline"
          onPress={() => {
            onCloseItem(id);
          }}
        />
      </YStack>
    </Stack>
  );
}

export default MobileTabListItem;
