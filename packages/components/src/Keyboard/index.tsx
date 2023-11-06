import { useCallback, useRef } from 'react';

import { chunk } from 'lodash';
import { XStack, YStack } from 'tamagui';

import { doHapticsWhenEnabled } from '@onekeyhq/shared/src/haptics';

import { Icon } from '../Icon';
import { Stack } from '../Stack';
import { Text } from '../Text';
import { Touchable } from '../Touchable';

type KeyType =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '.'
  | 'del';

function isNumber(key: KeyType) {
  return !(key === '.' || key === 'del');
}

const defaultKeys: KeyType[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '.',
  '0',
  'del',
];

type KeyboardProps = {
  keys?: KeyType[];
  text: string;
  onTextChange?: (text: string) => void;
  secure?: boolean;
  pattern?: RegExp;
  itemHeight?: string;
};

type KeyBoardItemProps = {
  item: KeyType;
  secure: boolean;
};
function KeyBoardItem({ item, secure }: KeyBoardItemProps) {
  if (item === 'del') {
    return <Icon name="DeleteOutline" size="$6" color="$icon" />;
  }
  if (isNumber(item) && secure) {
    return <Stack h="$2.5" w="$2.5" bg="$text" borderRadius="$2" />;
  }
  return <Text variant="$headingLg">{item}</Text>;
}

const removeLastCharacter = (text: string) => text.slice(0, text.length - 1);

export function Keyboard({
  keys,
  secure = false,
  text,
  onTextChange,
  pattern,
  itemHeight,
}: KeyboardProps) {
  const delIntervalRef = useRef<ReturnType<typeof setTimeout>>();
  const innerKeyArray = chunk(keys ?? defaultKeys, 3);
  const onPress = (item: KeyType) => {
    const prev = text;
    const inputText = text;
    let changeText = '';
    if (item === 'del') {
      changeText = removeLastCharacter(inputText);
    } else {
      changeText = prev + item;
      if (pattern && !pattern.test(prev + item)) {
        changeText = prev;
      }
      if (!prev && item === '.') {
        changeText = '0.';
      }
      if (prev === '0' && item !== '.') {
        changeText = (prev + item).substr(1);
      }
    }
    if (onTextChange) {
      doHapticsWhenEnabled();
      onTextChange(changeText);
    }
    return changeText;
  };

  const onLongPressDel = useCallback((prevText: string) => {
    const changedText = removeLastCharacter(prevText);
    onTextChange?.(changedText);
    if (changedText) {
      delIntervalRef.current = setTimeout(() => {
        onLongPressDel(changedText);
      }, 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPressOutDel = useCallback(() => {
    clearTimeout(delIntervalRef.current);
  }, []);

  return (
    <Stack w="100%">
      <YStack space="$2">
        {innerKeyArray.map((row, rowIndex) => (
          <XStack flex={1} space="$2" key={`keyboard row${rowIndex}`}>
            {row.map((item, index) => (
              <Touchable
                containerStyle={{
                  flex: 1,
                  // fix the issue where KeyboardItem widths are not equally distributed.
                  width: 0,
                }}
                key={`keyboard ${index}`}
                onPress={() => {
                  onPress(item);
                }}
                onLongPress={() => {
                  if (item === 'del') {
                    onLongPressDel(text);
                  }
                }}
                onPressOut={() => {
                  if (item === 'del') {
                    onPressOutDel();
                  }
                }}
              >
                <Stack
                  flex={1}
                  pressStyle={{
                    bg: '$bgHover',
                  }}
                  height={itemHeight ?? '$14'}
                  borderRadius="$3"
                  hoverStyle={{
                    bg: '$bgHover',
                  }}
                  justifyContent="center"
                  alignItems="center"
                >
                  <KeyBoardItem item={item} secure={secure} />
                </Stack>
              </Touchable>
            ))}
          </XStack>
        ))}
      </YStack>
    </Stack>
  );
}
