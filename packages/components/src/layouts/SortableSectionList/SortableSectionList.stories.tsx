import { useCallback, useMemo, useState } from 'react';

import { StyleSheet } from 'react-native';
import { fn } from 'storybook/test';

import { SortableSectionList } from '@onekeyhq/components/src/layouts/SortableSectionList';
import { Icon } from '@onekeyhq/components/src/primitives/Icon';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import {
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const CELL_HEIGHT = 48;
const HEADER_HEIGHT = 32;
const SECTION_GAP = 20;

interface ITokenRow {
  id: string;
  label: string;
}

interface ITokenSection {
  title: string;
  data: ITokenRow[];
}

const INITIAL_SECTIONS: ITokenSection[] = [
  {
    title: 'Favorites',
    data: [
      { id: 'btc', label: 'Bitcoin' },
      { id: 'eth', label: 'Ethereum' },
      { id: 'sol', label: 'Solana' },
    ],
  },
  {
    title: 'Watchlist',
    data: [
      { id: 'doge', label: 'Dogecoin' },
      { id: 'ton', label: 'Toncoin' },
      { id: 'ada', label: 'Cardano' },
    ],
  },
];

const SECTION_SEPARATOR = <Stack h={SECTION_GAP} />;

// The generic resolves to unknown at the call site, mirroring SectionList.
const keyExtractor = (item: unknown) => (item as ITokenRow).id;

const renderSectionHeader = ({ section }: { section: ITokenSection }) => (
  <XStack h={HEADER_HEIGHT} px="$4" ai="center" bg="$bgSubdued">
    <SizableText size="$headingXs" color="$textSubdued">
      {section.title}
    </SizableText>
  </XStack>
);

const renderTokenRow = ({
  item,
  drag,
  dragProps,
  isActive,
}: {
  item: ITokenRow;
  drag: () => void;
  dragProps: Record<string, any> | undefined;
  isActive: boolean;
}) => (
  <XStack
    h={CELL_HEIGHT}
    px="$4"
    ai="center"
    jc="space-between"
    bg={isActive ? '$bgActive' : '$bgApp'}
  >
    <SizableText size="$bodyMdMedium">{item.label}</SizableText>
    <Stack onPressIn={drag} dataSet={dragProps} cursor="move" p="$2">
      <Icon name="DragOutline" size="$5" color="$iconSubdued" />
    </Stack>
  </XStack>
);

// Sections flatten into one sortable list; the web engine positions
// every flattened row (separator, header, item, zero-height footer)
// from getItemLayout, so the layout table must mirror that order.
function SortableSectionListDemo({
  onOrderChange,
}: {
  onOrderChange?: (ids: string[]) => void;
}) {
  const [sections, setSections] = useState(INITIAL_SECTIONS);

  const layoutList = useMemo(() => {
    const layouts: { offset: number; length: number; index: number }[] = [];
    let offset = 0;
    sections.forEach((section, sectionIndex) => {
      if (sectionIndex !== 0) {
        layouts.push({ offset, length: SECTION_GAP, index: layouts.length });
        offset += SECTION_GAP;
      }
      layouts.push({ offset, length: HEADER_HEIGHT, index: layouts.length });
      offset += HEADER_HEIGHT;
      section.data.forEach(() => {
        layouts.push({ offset, length: CELL_HEIGHT, index: layouts.length });
        offset += CELL_HEIGHT;
      });
      layouts.push({ offset, length: 0, index: layouts.length });
    });
    return layouts;
  }, [sections]);

  const getItemLayout = useCallback(
    (_: unknown, index: number) =>
      index === -1 ? { index, offset: 0, length: 0 } : layoutList[index],
    [layoutList],
  );

  const handleDragEnd = useCallback(
    (result: { sections: Array<{ data?: ITokenRow[] }> }) => {
      const next = result.sections as ITokenSection[];
      setSections(next);
      onOrderChange?.(next.flatMap((section) => section.data.map((i) => i.id)));
    },
    [onOrderChange],
  );

  const listHeight =
    SECTION_GAP +
    2 * HEADER_HEIGHT +
    INITIAL_SECTIONS.reduce((sum, s) => sum + s.data.length, 0) * CELL_HEIGHT;

  return (
    <YStack
      h={listHeight + 2}
      w={320}
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
      overflow="hidden"
    >
      <SortableSectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderSectionHeader={renderSectionHeader}
        renderItem={renderTokenRow}
        SectionSeparatorComponent={SECTION_SEPARATOR}
        getItemLayout={getItemLayout}
        onDragEnd={handleDragEnd}
      />
    </YStack>
  );
}

const meta = {
  title: 'Layouts/SortableSectionList',
  component: SortableSectionListDemo,
  args: {
    onOrderChange: fn(),
  },
} satisfies Meta<typeof SortableSectionListDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
