import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalAddressBookRoutes } from '@onekeyhq/shared/src/routes';

import { AddressBookListContent } from '../../components/AddressBookListContent';
import { PageLoading } from '../../components/PageLoading';
import { UnsafeContent } from '../../components/UnsafeContent';
import { useAddressBookItems } from '../../hooks/useAddressBook';

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
        title={intl.formatMessage({ id: ETranslations.address_book_title })}
        headerRight={HeaderRightComponent}
      />
      <Page.Body>
        <AddressBookListContent items={result.items} showActions />
      </Page.Body>
    </Page>
  );
}

export default ListPage;
