import type { FC } from 'react';

import { NativeSectionList } from '@onekeyhq/components';

import type { IAddressBookSectionListProps } from './type';

export const AddressBookSectionList: FC<IAddressBookSectionListProps> = ({
  sections,
  renderItem,
  renderSectionHeader,
  ListEmptyComponent,
  keyExtractor,
  showsVerticalScrollIndicator,
}) => (
  <NativeSectionList
    showsVerticalScrollIndicator={showsVerticalScrollIndicator}
    sections={sections}
    renderItem={renderItem}
    renderSectionHeader={renderSectionHeader}
    ListEmptyComponent={ListEmptyComponent}
    keyExtractor={keyExtractor as any}
    windowSize={40}
  />
);
