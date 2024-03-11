import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

import { AddressBookListContent } from '../../components/AddressBookListContent';
import { PageLoading } from '../../components/PageLoading';
import { UnsafeContent } from '../../components/UnsafeContent';
import { useAddressBookItems } from '../../hooks/useAddressBook';
import { EModalAddressBookRoutes } from '@onekeyhq/shared/src/routes';

const HeaderRightComponent = () => {
  const navigation = useAppNavigation();
  const onPress = useCallback(() => {
    navigation.push(EModalAddressBookRoutes.AddItemModal);
  }, [navigation]);
  return (
    <IconButton
      variant="tertiary"
      icon="PlusCircleOutline"
      onPress={onPress}
      testID="address-book-add-icon"
    />
  );
};

function ListPage() {
  const intl = useIntl();
  const [searchText, setSearchText] = useState<string>('');
  const { isLoading, result } = useAddressBookItems();
  if (isLoading) {
    return <PageLoading />;
  }
  if (!result?.isSafe) {
    return <UnsafeContent />;
  }
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: 'title__address_book' })}
        headerRight={HeaderRightComponent}
        headerSearchBarOptions={{
          placeholder: intl.formatMessage({ id: 'form__search' }),
          onChangeText: (e) => setSearchText(e.nativeEvent.text),
        }}
      />
      <Page.Body>
        <AddressBookListContent
          sections={result?.items ?? []}
          showActions
          searchKey={searchText.trim()}
        />
      </Page.Body>
    </Page>
  );
}

export default ListPage;
