import { useState } from 'react';

import { SortableSectionList, Stack, Text } from '@onekeyhq/components';

import { mapIndexToData } from './SortableListView';
import { Layout } from './utils/Layout';

const SortableSectionListGallery = () => {
  const [sections, setSections] = useState(
    new Array(3).fill({}).map(() => ({
      data: new Array(5).fill({}).map(mapIndexToData),
    })),
  );
  return (
    <Layout
      scrollEnabled={false}
      elements={[
        {
          title: 'Styled ListView',
          element: (
            <SortableSectionList
              h={400}
              sections={sections}
              keyExtractor={(item: { index: number }) => `${item?.index}`}
              renderSectionHeader={({ index }) => (
                <SortableSectionList.SectionHeader title={`Section ${index}`} />
              )}
              renderItem={({
                item,
                drag,
              }: {
                item: { index: number; backgroundColor: string };
                drag: () => void;
              }) => (
                <SortableSectionList.ScaleDecorator activeScale={0.9}>
                  <Stack
                    onLongPress={drag}
                    bg={item.backgroundColor}
                    w="100%"
                    h={100}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text color="white">{item.index}</Text>
                  </Stack>
                </SortableSectionList.ScaleDecorator>
              )}
              onDragEnd={(result) => setSections(result.sections)}
            />
          ),
        },
      ]}
    />
  );
};

export default SortableSectionListGallery;
