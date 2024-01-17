import { StyleSheet } from 'react-native';

import {
  Icon,
  IconButton,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

import {
  TAB_LIST_CELL_WIDTH,
  TAB_LIST_ITEM_SPACING,
  THUMB_WIDTH,
} from '../../config/TabList.constants';
import { useWebTabDataById } from '../../hooks/useWebTabs';

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
  const { tab } = useWebTabDataById(id);
  const isActive = activeTabId === id;
  return (
    <Stack
      w={TAB_LIST_CELL_WIDTH}
      onPress={() => {
        onSelectedItem(id);
      }}
      onLongPress={() => {
        onLongPress(id);
      }}
      p="$0.5"
      mx={TAB_LIST_ITEM_SPACING / 2}
      mb={TAB_LIST_ITEM_SPACING}
      borderRadius="$4"
      borderWidth="$1"
      borderColor={isActive ? '$focusRing' : '$transparent'}
      animation="quick"
      pressStyle={{
        scale: 0.95,
      }}
      testID={`tab-modal-list-item-${id}`}
    >
      <YStack
        flex={1}
        collapsable={false}
        justifyContent="center"
        alignItems="center"
        borderRadius="$2.5"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        bg="$bgStrong"
        zIndex={1}
        overflow="hidden"
      >
        {/* Header */}
        <XStack py="$2" pl="$2.5" pr="$2" alignItems="center">
          <Image size="$4" borderRadius="$1">
            <Image.Source src={tab?.favicon} />
            <Image.Fallback>
              <Icon name="GlobusOutline" size="$4" />
            </Image.Fallback>
          </Image>
          <SizableText
            flex={1}
            size="$bodySm"
            textAlign="left"
            numberOfLines={1}
            mx="$2"
          >
            {tab?.title || ''}
          </SizableText>
          <IconButton
            variant="tertiary"
            size="small"
            icon="CrossedSmallOutline"
            onPress={() => onCloseItem(id)}
            testID={`tab-modal-header-close-${id}`}
          />
        </XStack>
        {/* Body */}
        <Image
          bg="$bg"
          w={THUMB_WIDTH}
          h={THUMB_WIDTH}
          source={{ uri: tab?.thumbnail }}
        />
      </YStack>
    </Stack>
  );
}

export default MobileTabListItem;
