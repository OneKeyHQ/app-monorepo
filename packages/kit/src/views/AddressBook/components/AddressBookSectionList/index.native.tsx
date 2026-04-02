import type { FC } from 'react';

import { SectionList } from '@onekeyhq/components';

import type { IAddressBookSectionListProps } from './type';

export const AddressBookSectionList: FC<IAddressBookSectionListProps> = ({
  sections,
  renderItem,
  renderSectionHeader,
  ListEmptyComponent,
  keyExtractor,
  showsVerticalScrollIndicator,
  estimatedItemSize,
}) => (
  <SectionList
    showsVerticalScrollIndicator={showsVerticalScrollIndicator}
    sections={sections}
    estimatedItemSize={estimatedItemSize}
    renderItem={renderItem}
    renderSectionHeader={renderSectionHeader}
    ListEmptyComponent={ListEmptyComponent}
    SectionSeparatorComponent={null}
    keyExtractor={keyExtractor as any}
  />
);
