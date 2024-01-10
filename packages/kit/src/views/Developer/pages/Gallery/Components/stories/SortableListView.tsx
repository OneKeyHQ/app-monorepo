import { useCallback, useState } from 'react';

import {
  Button,
  Page,
  SizableText,
  SortableCell,
  SortableListView,
  SwipeableCell,
} from '@onekeyhq/components';

export const mapIndexToData = (_d: any, index: number, array: any[]) => {
  const getColor = (i: number, numItems = 25) => {
    const multiplier = 255 / (numItems - 1);
    const colorVal = i * multiplier;
    return `rgb(${colorVal}, ${Math.abs(128 - colorVal)}, ${255 - colorVal})`;
  };
  const backgroundColor = getColor(index, array.length);
  return {
    index,
    backgroundColor,
  };
};

const CELL_HEIGHT = 100;

const SortableListViewGallery = () => {
  const [data, setData] = useState(new Array(15).fill({}).map(mapIndexToData));
  const [isEditing, setIsEditing] = useState(false);
  const headerRight = useCallback(
    () => (
      <Button onPress={() => setIsEditing(!isEditing)}>
        {!isEditing ? 'Edit' : 'Done'}
      </Button>
    ),
    [isEditing, setIsEditing],
  );

  const deleteCell = useCallback(
    (getIndex: () => number | undefined) => {
      const index = getIndex();
      if (index === undefined) {
        return;
      }
      const reloadData = [...data];
      reloadData.splice(index, 1);
      setData(reloadData);
    },
    [data, setData],
  );

  return (
    <Page>
      <Page.Header headerRight={headerRight} />
      <SortableListView
        bg="$bgApp"
        data={data}
        keyExtractor={(item) => `${item.index}`}
        renderItem={({ item, getIndex, drag, isActive }) => (
          <SwipeableCell
            swipeEnabled={!isEditing}
            rightItemList={[
              {
                width: 200,
                title: 'DELETE',
                backgroundColor: '$bgCriticalStrong',
                onPress: ({ close }) => {
                  close?.();
                  deleteCell(getIndex);
                },
              },
            ]}
          >
            <SortableCell
              h={CELL_HEIGHT}
              isEditing={isEditing}
              alignItems="center"
              justifyContent="center"
              bg={item.backgroundColor}
              drag={drag}
              isActive={isActive}
              onDeletePress={() => {
                deleteCell(getIndex);
              }}
            >
              <SizableText color="white">
                {item.index}可左滑拖动删除
              </SizableText>
            </SortableCell>
          </SwipeableCell>
        )}
        getItemLayout={(_, index) => ({
          length: CELL_HEIGHT,
          offset: index * CELL_HEIGHT,
          index,
        })}
        onDragEnd={(result) => setData(result.data)}
      />
    </Page>
  );
};

export default SortableListViewGallery;
