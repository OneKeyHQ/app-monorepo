import { useState } from 'react';

import { Pressable } from 'react-native';

import { SortableCell, SortableSectionList, Text } from '@onekeyhq/components';

import { mapIndexToData } from './SortableListView';

const CELL_HEIGHT = 100;

const SortableSectionListGallery = () => {
  const [sections, setSections] = useState(
    new Array(3).fill({}).map(() => ({
      data: new Array(10).fill({}).map(mapIndexToData),
    })),
  );
  return (
    <SortableSectionList
      bg="$bgApp"
      sections={sections}
      keyExtractor={(item: { index: number }) => `${item?.index}`}
      getItemLayout={(_, index) => ({
        offset: CELL_HEIGHT,
        length: CELL_HEIGHT * index,
        index,
      })}
      renderSectionHeader={({ index }) => (
        <SortableSectionList.SectionHeader px={0} title={`Section ${index}`} />
      )}
      renderItem={({
        item,
        drag,
        isActive,
      }: {
        item: { index: number; backgroundColor: string };
        drag: () => void;
        isActive: boolean;
      }) => (
        <Pressable onLongPress={drag}>
          <SortableCell
            h={CELL_HEIGHT}
            alignItems="center"
            justifyContent="center"
            bg={item.backgroundColor}
            drag={drag}
            isActive={isActive}
          >
            <Text color="white">{item.index}长按拖动</Text>
          </SortableCell>
        </Pressable>
      )}
      onDragEnd={(result) => setSections(result.sections)}
      stickySectionHeadersEnabled
    />
  );
};

export default SortableSectionListGallery;
