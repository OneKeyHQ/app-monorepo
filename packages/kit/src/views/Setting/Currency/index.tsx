import { useCallback } from 'react';

import {
  ListItem,
  Page,
  SearchBar,
  SectionList,
  Stack,
  Text,
} from '@onekeyhq/components';

const mockSections = [
  {
    title: 'popular',
    data: [
      {
        symbol: '$',
        name: 'USD',
        fullName: 'US dollar',
      },
      {
        symbol: '$',
        name: 'USD',
        fullName: 'US dollar',
      },
      {
        symbol: '$',
        name: 'USD',
        fullName: 'US dollar',
      },
    ],
  },
  {
    title: 'CRYPTOCURRENCY',
    data: [
      {
        symbol: '₿',
        name: 'BTC',
        fullName: 'Bitcoin',
      },
      {
        symbol: 'Ξ',
        name: 'ETH',
        fullName: 'Ether',
      },
    ],
  },
];

const ListHeaderComponent = () => (
  <Stack px="$4" pt="$4">
    <SearchBar />
  </Stack>
);

export default function SettingCurrencyModal() {
  const renderItem = useCallback(
    () => <ListItem title="USD - $" subtitle="US dollar" checkMark />,
    [],
  );
  const renderSectionHeader = useCallback(
    () => (
      <Stack p="$4">
        <Text>Header</Text>
      </Stack>
    ),
    [],
  );
  return (
    <Page>
      <SectionList
        estimatedItemSize="$6"
        ListHeaderComponent={ListHeaderComponent}
        sections={mockSections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
      />
    </Page>
  );
}
