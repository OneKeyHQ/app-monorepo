import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalAddressBookRoutes } from '@onekeyhq/shared/src/routes';

import { AddressBookListContent } from '../../components/AddressBookListContent';
import { ContentContainer } from '../../components/ContentContainer';
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
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.address_book_title })}
        headerRight={HeaderRightComponent}
      />
      <Page.Body>
        <ContentContainer
          loading={isLoading}
          error={Boolean(!isLoading && !result)}
          unsafe={result?.isSafe === false}
        >
          <AddressBookListContent items={result?.items ?? []} showActions />
        </ContentContainer>
      </Page.Body>
    </Page>
  );
}

export default ListPage;
