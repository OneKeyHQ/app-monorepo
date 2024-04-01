import { useCallback } from 'react';

import {
  Icon,
  IconButton,
  ListView,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';

const KEYBOARD_DELETE_CHAR = 'x';

export function PasswordKeyboard({
  value = '',
  onChange,
}: {
  value?: string;
  onChange?: (value: string) => void;
}) {
  const onItemPress = useCallback(
    (item: string) => {
      if (item === KEYBOARD_DELETE_CHAR) {
        onChange?.(value.substr(0, value.length - 1));
      } else if (value.length < 6) {
        onChange?.(value + item);
      }
    },
    [value, onChange],
  );
  const renderItem = useCallback(
    ({ item, index }: { item: string; index: number }) => (
      <Stack
        bg="$bgStrong"
        disabled={item.length <= 0}
        focusStyle={{
          bg: '$bgActive',
        }}
        hoverStyle={{
          bg: '$bgActive',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
        $platform-native={{
          flex: 1,
        }}
        $platform-web={{
          width: '33.3%',
        }}
        marginRight={index % 3 !== 2 ? 1 : 0}
        marginTop={Math.floor(index / 3) > 0 ? 1 : 0}
        h="$14"
        justifyContent="center"
        alignItems="center"
        onPress={() => onItemPress(item)}
      >
        {item === KEYBOARD_DELETE_CHAR ? (
          <Icon name="XBackspaceOutline" color="$iconStrong" />
        ) : (
          <SizableText size="$heading3xl">{item}</SizableText>
        )}
      </Stack>
    ),
    [onItemPress],
  );
  return (
    <Stack borderRadius="$3" overflow="hidden" userSelect="none">
      <XStack bg="$bgSubdued" h="$12" alignItems="center">
        <SizableText flex={1} size="$heading4xl" textAlign="center">
          {new Array(value.length).fill('•').join('')}
        </SizableText>
        <Stack
          position="absolute"
          right="$3"
          top={0}
          bottom={0}
          justifyContent="center"
          alignItems="center"
        >
          <IconButton
            icon="XBackspaceOutline"
            color="$iconSubdued"
            variant="tertiary"
            onPress={() => onItemPress(KEYBOARD_DELETE_CHAR)}
          />
        </Stack>
      </XStack>
      <ListView
        scrollEnabled={false}
        data={[
          '1',
          '2',
          '3',
          '4',
          '5',
          '6',
          '7',
          '8',
          '9',
          '',
          '0',
          KEYBOARD_DELETE_CHAR,
        ]}
        numColumns={3}
        estimatedItemSize="$10"
        renderItem={renderItem}
      />
    </Stack>
  );
}
