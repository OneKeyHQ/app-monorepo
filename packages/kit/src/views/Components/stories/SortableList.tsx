import React, { useState } from 'react';

import {
  Center,
  Flex,
  Icon,
  Pressable,
  SortableList,
  Switch,
  Typography,
} from '@onekeyhq/components';

const initialData: { id: number; text: string }[] = [
  { id: 1, text: 'Chloe' },
  { id: 2, text: 'Jasper' },
  { id: 3, text: 'Pepper' },
  { id: 4, text: 'Oscar' },
  { id: 5, text: 'Dusty' },
  { id: 6, text: 'Spooky' },
  { id: 7, text: 'Kiki' },
  { id: 8, text: 'Smokey' },
  { id: 9, text: 'Gizmo' },
  { id: 10, text: 'Kitty' },
];

const SortableListGallery = () => {
  const [list, setList] = useState(initialData);
  const [enable, setEnable] = useState(false);
  return (
    <Center flex="1" bg="background-hovered" p="4">
      <SortableList.Container
        keyExtractor={({ id }) => String(id)}
        data={list}
        onDragEnd={({ data }) => setList(data)}
        renderItem={({ item, drag }) => (
          <Flex
            borderBottomWidth="1"
            borderColor="border-default"
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            h="10"
            minW="80"
          >
            <Flex direction="row" alignItems="center">
              <Pressable onPressIn={() => drag()}>
                <Icon name="MenuOutline" size={16} />
              </Pressable>
              <Typography.Body1 ml="2">{item.text}</Typography.Body1>
            </Flex>
            <Switch
              labelType="false"
              isChecked={enable}
              onToggle={() => setEnable(!enable)}
            />
          </Flex>
        )}
      />
    </Center>
  );
};

export default SortableListGallery;
