import { type FC, useCallback, useRef } from 'react';

import { chunk } from 'lodash';
import { Center, Column, Pressable, Row } from 'native-base';

import { doHapticsWhenEnabled } from '@onekeyhq/shared/src/haptics';

import Box from '../Box';
import Icon from '../Icon';
import Typography from '../Typography';

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
const KeyBoardItem: FC<KeyBoardItemProps> = ({ item, secure }) => {
  if (item === 'del') {
    return <Icon name="BackspaceOutline" size={24} color="icon-default" />;
  }
  if (isNumber(item) && secure) {
    return <Box size="10px" bgColor="text-default" borderRadius="5px" />;
  }
  return <Typography.DisplayXLarge>{item}</Typography.DisplayXLarge>;
};

const removeLastCharacter = (text: string) => text.slice(0, text.length - 1);

const Keyboard: FC<KeyboardProps> = ({
  keys,
  secure = false,
  text,
  onTextChange,
  pattern,
  itemHeight,
}) => {
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
    <Box width="full" height="auto">
      <Column space="8px">
        {innerKeyArray.map((row, rowIndex) => (
          <Row width="full" space="8px" key={`keyboard row${rowIndex}`}>
            {row.map((item, index) => (
              <Pressable
                key={`keyboard ${index}`}
                borderRadius="12px"
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
                height={itemHeight ?? '56px'}
                flex={1}
                _pressed={{ bg: 'surface-pressed' }}
                _hover={{ bg: 'surface-hovered' }}
              >
                <Center flex={1}>
                  <KeyBoardItem item={item} secure={secure} />
                </Center>
              </Pressable>
            ))}
          </Row>
        ))}
      </Column>
    </Box>
  );
};

export default Keyboard;
