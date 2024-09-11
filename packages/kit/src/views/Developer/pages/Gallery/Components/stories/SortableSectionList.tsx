import { useCallback, useMemo, useState } from 'react';

import {
  Button,
  Page,
  SortableSectionList,
  Stack,
  SwipeableCell,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

import { mapIndexToData } from './SortableListView';

const CELL_HEIGHT = 70;

const SortableSectionListGallery = () => {
  const [sections, setSections] = useState(
    new Array(10).fill({}).map(() => ({
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
  const layoutList = useMemo(() => {
    let offset = 100;
    const layouts: { offset: number; length: number; index: number }[] = [];
    sections.forEach((section, sectionIndex) => {
      if (sectionIndex !== 0) {
        layouts.push({ offset, length: 8, index: layouts.length });
        offset += 8;
      }
      const headerHeight = 36;
      layouts.push({ offset, length: headerHeight, index: layouts.length });
      offset += headerHeight;
      section.data.forEach(() => {
        layouts.push({ offset, length: CELL_HEIGHT, index: layouts.length });
        offset += CELL_HEIGHT;
      });
      const footerHeight = 0;
      layouts.push({ offset, length: footerHeight, index: layouts.length });
      offset += footerHeight;
    });
    return layouts;
  }, [sections]);
  return (
    <Page>
      <Page.Header headerRight={headerRight} />
      <SortableSectionList
        bg="$bgApp"
        sections={sections}
        enabled={isEditing}
        keyExtractor={(item) => `${(item as { index: number }).index}`}
        getItemLayout={(_, index) => {
          if (index === -1) {
            return {
              index,
              offset: 100,
              length: 0,
            };
          }
          return layoutList[index];
        }}
        renderSectionHeader={({ index }) => (
          <SortableSectionList.SectionHeader
            px={0}
            title={`Section ${index}`}
          />
        )}
        ListHeaderComponent={<Stack h={100} />}
        initialScrollIndex={{ sectionIndex: 4, itemIndex: 5 }}
        renderItem={({ item, section, drag, dragProps }) => (
          <SwipeableCell
            swipeEnabled={!isEditing}
            rightItemList={[
              {
                width: 200,
                title: 'DELETE',
                backgroundColor: '$bgCriticalStrong',
                onPress: ({ close }) => {
                  close?.();
                  deleteCell(() => (item as { index: number }).index, section);
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
              {isEditing ? (
                <ListItem.IconButton
                  key="darg"
                  cursor="move"
                  icon="DragOutline"
                  onPressIn={drag}
                  dataSet={dragProps}
                />
              ) : null}
            </ListItem>
          </SwipeableCell>
        )}
        onDragEnd={(result) =>
          setSections(
            result.sections as {
              data: { index: number; backgroundColor: string }[];
            }[],
          )
        }
        stickySectionHeadersEnabled
      />
    </Page>
  );
};

export default SortableSectionListGallery;
