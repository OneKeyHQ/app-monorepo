import { useMemo } from 'react';

import { Image } from 'react-native';

import { IconButton, Stack, Text } from '@onekeyhq/components';

import { useWebTabData } from '../../hooks/useWebTabs';

function DesktopCustomTabBarItem({
  id,
  activeTabId,
  onPress,
  onCloseTab,
}: {
  id: string;
  activeTabId: string | null;
  onPress: (id: string) => void;
  onCloseTab: (id: string) => void;
}) {
  const { tab } = useWebTabData(id);
  const isActive = useMemo(() => activeTabId === id, [activeTabId, id]);
  return (
    <Stack
      key={id}
      flexDirection="row"
      alignItems="center"
      py="$1.5"
      px="$2"
      bg={isActive ? '$bgActive' : undefined}
      borderRadius="$2"
      onPress={() => onPress(id)}
    >
      {isActive && <Stack w="$1" h="100%" bg="$iconActive" mr="$2" />}
      {tab?.favicon && (
        <Image
          style={{ width: 16, height: 16, marginRight: 8 }}
          source={{ uri: tab?.favicon }}
        />
      )}
      <Text>{tab.title}</Text>
      <IconButton
        icon="CrossedSmallOutline"
        size="small"
        onPress={(e) => {
          e.stopPropagation();
          onCloseTab?.(id);
        }}
      />
    </Stack>
  );
}

export default DesktopCustomTabBarItem;
