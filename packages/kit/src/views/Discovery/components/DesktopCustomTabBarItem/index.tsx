import { useMemo } from 'react';

import { Image } from 'react-native';

import { IconButton, Stack, Text } from '@onekeyhq/components';

import { useWebTabData } from '../../hooks/useWebTabs';

function DesktopCustomTabBarItem({
  id,
  activeTabId,
  onPress,
  onCloseTab,
  onLongPress,
}: {
  id: string;
  activeTabId: string | null;
  onPress: (id: string) => void;
  onCloseTab: (id: string) => void;
  onLongPress: (id: string) => void;
}) {
  const { tab } = useWebTabData(id);
  const isActive = useMemo(() => activeTabId === id, [activeTabId, id]);
  const isPinned = useMemo(() => tab.isPinned, [tab.isPinned]);
  const bgColor = useMemo(() => {
    if (isActive && isPinned) {
      return '$bgCriticalStrong';
    }
    if (isPinned) {
      return '$bgCautionStrong';
    }
    if (isActive) {
      return '$bgActive';
    }
    return undefined;
  }, [isActive, isPinned]);
  return (
    <Stack
      key={id}
      flexDirection="row"
      alignItems="center"
      py="$1.5"
      px="$2"
      bg={bgColor}
      borderRadius="$2"
      onPress={() => onPress(id)}
      // @ts-expect-error
      onContextMenu={(event) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        event.preventDefault();
        console.log('===> onContextMenu: ');
        onLongPress(id);
      }}
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
