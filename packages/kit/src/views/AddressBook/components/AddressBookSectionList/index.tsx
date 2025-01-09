import type { FC } from 'react';

import {
  NativeSectionList,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';

import type { IAddressBookSectionListProps } from './type';

export const AddressBookSectionList: FC<IAddressBookSectionListProps> = ({
  sections,
  renderItem,
  renderSectionHeader,
  ListEmptyComponent,
  keyExtractor,
  showsVerticalScrollIndicator,
}) => {
  const { bottom } = useSafeAreaInsets();

  return (
    <NativeSectionList
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      sections={sections}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      ListEmptyComponent={ListEmptyComponent}
      keyExtractor={keyExtractor as any}
      windowSize={40}
      ListFooterComponent={<YStack h={bottom || '$3'} />}
    />
  );
};
