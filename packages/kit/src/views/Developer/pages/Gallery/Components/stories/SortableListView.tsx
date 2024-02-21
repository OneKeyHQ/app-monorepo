import { useCallback, useState } from 'react';

import {
  Button,
  Page,
  SortableListView,
  SwipeableCell,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

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

const CELL_HEIGHT = 70;

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
        enabled={isEditing}
        keyExtractor={(item) => `${item.index}`}
        renderItem={({ item, getIndex, drag }) => (
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
            <ListItem
              h={CELL_HEIGHT}
              avatarProps={{
                src: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/btc.png',
                size: '$8',
              }}
              title={`${item.index}可左滑拖动删除`}
              {...(!isEditing && {
                onPress: () => console.log(`点击${item.index}`),
              })}
            >
              {isEditing && (
                <ListItem.IconButton
                  key="darg"
                  animation="quick"
                  enterStyle={{
                    opacity: 0,
                    scale: 0,
                  }}
                  cursor="move"
                  icon="DragOutline"
                  onPressIn={drag}
                />
              )}
            </ListItem>
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
