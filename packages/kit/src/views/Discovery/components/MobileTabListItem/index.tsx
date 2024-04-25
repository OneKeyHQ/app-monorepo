import { StyleSheet } from 'react-native';

import {
  Divider,
  Group,
  Icon,
  IconButton,
  Image,
  SizableText,
  Skeleton,
  Stack,
  XStack,
} from '@onekeyhq/components';

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
      width="100%"
      onPress={() => {
        onSelectedItem(id);
      }}
      onLongPress={() => {
        onLongPress(id);
      }}
      p="$1"
      animation="quick"
      pressStyle={{
        scale: 0.95,
      }}
      testID={`tab-modal-list-item-${id}`}
    >
      <Stack
        borderRadius="$4"
        borderWidth="$1"
        borderColor={isActive ? '$brand6' : '$transparent'}
        p="$0.5"
        borderCurve="continuous"
        testID={
          isActive
            ? `tab-modal-active-item-${id}`
            : `tab-modal-no-active-item-${id}`
        }
      >
        <Group
          borderRadius="$2.5"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
          separator={<Divider />}
        >
          <Group.Item>
            <XStack
              py="$2"
              pl="$2.5"
              pr="$2"
              alignItems="center"
              bg="$bgSubdued"
              borderCurve="continuous"
            >
              <Image size="$4" borderRadius="$1">
                <Image.Source src={tab?.favicon} />
                <Image.Fallback>
                  <Icon name="GlobusOutline" size="$4" />
                </Image.Fallback>
                <Image.Loading>
                  <Skeleton width="100%" height="100%" />
                </Image.Loading>
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
          </Group.Item>
          <Group.Item>
            <Stack pb="100%">
              <Stack position="absolute" left={0} top={0} right={0} bottom={0}>
                <Image
                  w="100%"
                  h="100%"
                  borderBottomLeftRadius={10}
                  borderBottomRightRadius={10}
                >
                  <Image.Source source={{ uri: tab?.thumbnail }} />
                </Image>
              </Stack>
            </Stack>
          </Group.Item>
        </Group>
      </Stack>
    </Stack>
  );
}

export default MobileTabListItem;
