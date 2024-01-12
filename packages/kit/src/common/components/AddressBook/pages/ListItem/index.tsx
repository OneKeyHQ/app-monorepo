import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, Page, Spinner, Stack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

import { AddressBookListContent } from '../../components/AddressBookListContent';
import { useAddressBookItems } from '../../hooks/useAddressBook';
import { EModalAddressBookRoutes } from '../../router/types';

import type { IAddressItem } from '../../type';

const HeaderRightComponent = () => {
  const navigation = useAppNavigation();
  const onPress = useCallback(() => {
    navigation.push(EModalAddressBookRoutes.AddItemModal);
  }, [navigation]);
  return (
    <IconButton variant="tertiary" icon="PlusCircleOutline" onPress={onPress} />
  );
};

function ListPage() {
  const intl = useIntl();
  const [searchText, setSearchText] = useState<string>('');
  const { isLoading, result } = useAddressBookItems();
  const sections = useMemo(() => {
    if (!result) {
      return [];
    }
    const data = result.reduce((acc, item) => {
      const [type] = item.networkId.split('--');
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(item);
      return acc;
    }, {} as Record<string, IAddressItem[]>);
    return Object.entries(data).map((o) => ({ title: o[0], data: o[1] }));
  }, [result]);
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: 'title__address_book' })}
        headerRight={HeaderRightComponent}
        headerSearchBarOptions={{
          placeholder: 'Search',
          onChangeText: (e) => setSearchText(e.nativeEvent.text),
        }}
      />
      <Page.Body>
        {isLoading ? (
          <Stack h="$10" justifyContent="center" alignItems="center">
            <Spinner />
          </Stack>
        ) : (
          <AddressBookListContent
            sections={sections}
            showActions
            searchKey={searchText.trim()}
          />
        )}
      </Page.Body>
    </Page>
  );
}

export default ListPage;
