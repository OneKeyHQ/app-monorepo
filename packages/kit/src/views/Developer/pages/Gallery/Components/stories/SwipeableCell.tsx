import { useState } from 'react';

import {
  ListView,
  SizableText,
  Stack,
  SwipeableCell,
} from '@onekeyhq/components';

import { mapIndexToData } from './SortableListView';

const CELL_HEIGHT = 100;

const SwipeableCellGallery = () => {
  const [data] = useState(new Array(15).fill({}).map(mapIndexToData));

  return (
    <ListView
      bg="$bgApp"
      data={data}
      keyExtractor={(item) => `${item.index}`}
      renderItem={({ item }) => (
        <SwipeableCell
          leftItemList={[
            {
              width: 90,
              title: 'MORE',
              backgroundColor: 'orange',
              onPress: ({ close }) => close?.(),
            },
            {
              width: 70,
              title: 'THANKS',
              backgroundColor: 'blue',
              onPress: ({ close }) => close?.(),
            },
            {
              width: 90,
              title: 'DELETE',
              backgroundColor: '$bgCriticalStrong',
              onPress: ({ close }) => close?.(),
            },
          ]}
          rightItemList={[
            {
              width: 90,
              title: 'MORE',
              backgroundColor: 'orange',
              onPress: ({ close }) => close?.(),
            },
            {
              width: 70,
              title: 'THANKS',
              backgroundColor: 'blue',
              onPress: ({ close }) => close?.(),
            },
            {
              width: 90,
              title: 'DELETE',
              backgroundColor: 'red',
              onPress: ({ close }) => close?.(),
            },
          ]}
        >
          <Stack
            h={CELL_HEIGHT}
            alignItems="center"
            justifyContent="center"
            bg={item.backgroundColor}
          >
            <SizableText color="white">{item.index}可左右拖动</SizableText>
          </Stack>
        </SwipeableCell>
      )}
      estimatedItemSize={CELL_HEIGHT}
    />
  );
};

export default SwipeableCellGallery;
