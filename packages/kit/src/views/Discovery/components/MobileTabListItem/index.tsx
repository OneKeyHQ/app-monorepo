import { useMemo } from 'react';

import { IconButton, Stack, Text } from '@onekeyhq/components';

import type { IWebTab } from '../../types';

function MobileTabListItem({
  title,
  id,
  url,
  activeTabId,
  onSelectedItem,
  onCloseItem,
}: IWebTab & {
  activeTabId: string | null;
  onSelectedItem: (id: string) => void;
  onCloseItem: (id: string) => void;
}) {
  const isActive = useMemo(() => activeTabId === id, [id, activeTabId]);
  return (
    <Stack
      w="full"
      px="2"
      mt="$4"
      onPress={() => {
        onSelectedItem(id);
      }}
    >
      <Stack
        w="full"
        py="$1"
        bg="$background-default"
        borderRadius="$3"
        borderWidth={1}
        borderColor={isActive ? '$borderActive' : '$borderCritical'}
        overflow="hidden"
      >
        <Stack flex={1} collapsable={false}>
          <Stack flex={1} ml="$2" mr="$1">
            <Text color="$text" flex={1} textAlign="left" numberOfLines={1}>
              {title || 'Unknown'}
            </Text>
            <Text color="$text" numberOfLines={2}>
              {url}
            </Text>
          </Stack>
          <IconButton
            size="small"
            variant="primary"
            icon="CrossedSmallOutline"
            onPress={() => {
              onCloseItem(id);
            }}
          />
        </Stack>
      </Stack>
    </Stack>
  );
}

export default MobileTabListItem;
