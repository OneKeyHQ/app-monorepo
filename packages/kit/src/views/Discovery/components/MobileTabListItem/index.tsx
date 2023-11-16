import { useMemo } from 'react';

import { StyleSheet } from 'react-native';

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
      mr="$3"
      mb="$3"
      onPress={() => {
        onSelectedItem(id);
      }}
      onLongPress={() => {
        onLongPress(id);
      }}
      borderRadius="$3"
      borderWidth="$0.5"
      borderColor={isActive ? '$borderActive' : '$transparent'}
      overflow="hidden"
    >
      <YStack
        m="$0.5"
        flex={1}
        collapsable={false}
        justifyContent="center"
        alignItems="center"
        borderRadius="$2"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        bg="$bgStrong"
        zIndex={1}
        overflow="hidden"
      >
        <XStack
          py="$2"
          pl="$2.5"
          pr="$2"
          justifyContent="center"
          alignItems="center"
          h="$8"
          space="$2"
        >
          <Image
            w={16}
            h={16}
            source={{ uri: tab?.favicon }}
            borderRadius="$1"
          />
          <Text flex={1} variant="$bodySm" textAlign="left" numberOfLines={1}>
            {tab?.title || ''}
          </Text>
          <IconButton
            variant="tertiary"
            size="small"
            icon="CrossedSmallOutline"
            onPress={() => onCloseItem(id)}
          />
        </XStack>
        <Image
          w={THUMB_WIDTH}
          h={THUMB_HEIGHT}
          source={{ uri: tab?.thumbnail }}
        />
      </YStack>
    </Stack>
  );
}

export default MobileTabListItem;
