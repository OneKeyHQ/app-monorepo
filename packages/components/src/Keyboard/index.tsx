import React, { FC } from 'react';

import { chunk } from 'lodash';
import { Center, Column, Pressable, Row } from 'native-base';

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
  onKeyPress?: (text: KeyType) => void;
  onDelete?: () => void;
  secure?: boolean;
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

const Keyboard: FC<KeyboardProps> = ({
  keys,
  onKeyPress,
  onDelete,
  secure = false,
}) => {
  const innerKeyArray = chunk(keys ?? defaultKeys, 3);
  const onPress = (item: KeyType) => {
    if (item === 'del' && onDelete) {
      onDelete();
    } else if (onKeyPress) {
      onKeyPress(item);
    }
  };
  return (
    <Box width="full" height="auto" paddingX="10px">
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
                height="56px"
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
