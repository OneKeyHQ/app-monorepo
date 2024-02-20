import { useCallback, useState } from 'react';

import {
  Button,
  Page,
  SortableSectionList,
  SwipeableCell,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

import { mapIndexToData } from './SortableListView';

const CELL_HEIGHT = 70;

const SortableSectionListGallery = () => {
  const [sections, setSections] = useState(
    new Array(3).fill({}).map(() => ({
      data: new Array(10).fill({}).map(mapIndexToData),
    })),
  );
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
    (getIndex: () => number | undefined, section: any) => {
      const index = getIndex();
      if (index === undefined) {
        return;
      }
      const findSection = sections.find((s) => s === section);
      if (!findSection) {
        return;
      }
      const reloadData = [...findSection.data];
      reloadData.splice(index, 1);
      findSection.data = reloadData;
      setSections(section);
    },
    [sections, setSections],
  );
  return (
    <Page>
      <Page.Header headerRight={headerRight} />
      <SortableSectionList
        bg="$bgApp"
        sections={sections}
        enabled={isEditing}
        keyExtractor={(item: { index: number }) => `${item?.index}`}
        getItemLayout={(_, index) => ({
          offset: CELL_HEIGHT,
          length: CELL_HEIGHT * index,
          index,
        })}
        renderSectionHeader={({ index }) => (
          <SortableSectionList.SectionHeader
            px={0}
            title={`Section ${index}`}
          />
        )}
        renderItem={({ item, getIndex, section, drag }) => (
          <SwipeableCell
            swipeEnabled={!isEditing}
            rightItemList={[
              {
                width: 200,
                title: 'DELETE',
                backgroundColor: '$bgCriticalStrong',
                onPress: ({ close }) => {
                  close?.();
                  deleteCell(getIndex, section);
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
              title={`${(item as { index: number }).index}可左滑拖动删除`}
              {...(!isEditing && {
                onPress: () =>
                  console.log(`点击${(item as { index: number }).index}`),
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
        onDragEnd={(result) => setSections(result.sections)}
        stickySectionHeadersEnabled
      />
    </Page>
  );
};

export default SortableSectionListGallery;
