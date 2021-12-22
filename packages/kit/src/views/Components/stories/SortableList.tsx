import React, { useState } from 'react';

import { Center, Flex, SortableList, Typography } from '@onekeyhq/components';

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
  return (
    <Center flex="1" bg="background-hovered" p="4">
      <SortableList
        keyExtractor={({ id }) => String(id)}
        data={list}
        onDragEnd={({ data }) => setList(data)}
        renderItem={({ item, drag }) => (
          <SortableList.ListItem onLongPress={drag}>
            <Flex
              borderBottomWidth="1"
              borderColor="border-default"
              direction="row"
              alignItems="center"
              h="10"
              minW="80"
            >
              <Typography.Body1>{item.text}</Typography.Body1>
            </Flex>
          </SortableList.ListItem>
        )}
      />
    </Center>
  );
};

export default SortableListGallery;
