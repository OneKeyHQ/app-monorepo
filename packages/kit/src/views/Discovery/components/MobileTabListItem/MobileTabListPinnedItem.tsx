import { Icon, Image, SizableText, Skeleton, Stack, XStack } from '@onekeyhq/components';

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
  const isActive = activeTabId === id;
  return (
    <Stack
      flex={1}
      p="$0.5"
      minWidth="$28"
      maxWidth="$40"
      borderRadius="$4"
      borderWidth={4}
      borderColor={isActive ? '$brand6' : '$transparent'}
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
        <Image size="$4" borderRadius="$1">
          <Image.Source src={tab?.favicon} />
          <Image.Fallback delayMs={100}>
            <Icon name="GlobusOutline" size="$4" />
          </Image.Fallback>
          <Image.Loading>
            <Skeleton width="100%" height="100%" />
          </Image.Loading>
        </Image>
        <SizableText flex={1} size="$bodySm" numberOfLines={1} ml="$2">
          {tab?.title || ''}
        </SizableText>
      </XStack>
    </Stack>
  );
}

export default MobileTabListPinnedItem;
