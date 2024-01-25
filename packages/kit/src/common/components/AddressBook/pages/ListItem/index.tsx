import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, Page, Spinner, Stack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

import { AddressBookListContent } from '../../components/AddressBookListContent';
import { useAddressBookItems } from '../../hooks/useAddressBook';
import { EModalAddressBookRoutes } from '../../router/types';

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
            sections={result ?? []}
            showActions
            searchKey={searchText.trim()}
          />
        )}
      </Page.Body>
    </Page>
  );
}

export default ListPage;
