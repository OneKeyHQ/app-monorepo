import { useState } from 'react';

import { SortableSectionList, Stack, Text } from '@onekeyhq/components';

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
      }: {
        item: { index: number; backgroundColor: string };
      }) => (
        <Stack
          w="100%"
          h={CELL_HEIGHT}
          alignItems="center"
          justifyContent="center"
          bg={item.backgroundColor}
        >
          <Text color="white">{item.index}</Text>
        </Stack>
      )}
      onDragEnd={(result) => setSections(result.sections)}
      stickySectionHeadersEnabled
    />
  );
};

export default SortableSectionListGallery;
