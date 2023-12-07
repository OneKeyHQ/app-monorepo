import { useState } from 'react';

import { Pressable } from 'react-native';

import { SortableSectionList, Text } from '@onekeyhq/components';

import { mapIndexToData } from './SortableListView';

const SortableSectionListGallery = () => {
  const [sections, setSections] = useState(
    new Array(3).fill({}).map(() => ({
      data: new Array(5).fill({}).map(mapIndexToData),
    })),
  );
  return (
    <SortableSectionList
      bg="$bgApp"
      sections={sections}
      keyExtractor={(item: { index: number }) => `${item?.index}`}
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
        // Don't use `Stack.onLongPress` as it will only be called after `onPressOut`
        <SortableSectionList.ShadowDecorator>
          <SortableSectionList.ScaleDecorator activeScale={0.9}>
            <Pressable
              onLongPress={drag}
              disabled={isActive}
              style={{
                backgroundColor: item.backgroundColor,
                width: '100%',
                height: 100,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text color="white">{item.index}</Text>
            </Pressable>
          </SortableSectionList.ScaleDecorator>
        </SortableSectionList.ShadowDecorator>
      )}
      onDragEnd={(result) => setSections(result.sections)}
      stickySectionHeadersEnabled
    />
  );
};

export default SortableSectionListGallery;
