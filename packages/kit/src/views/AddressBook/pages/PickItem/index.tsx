import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAddressBookRoutes,
  IModalAddressBookParamList,
} from '@onekeyhq/shared/src/routes/addressBook';

import { AddressBookListContent } from '../../components/AddressBookListContent';
import { PageLoading } from '../../components/PageLoading';
import { UnsafeContent } from '../../components/UnsafeContent';
import { useAddressBookItems } from '../../hooks/useAddressBook';

import type { IAddressItem } from '../../type';
import type { RouteProp } from '@react-navigation/core';

const PickItemPage = () => {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        IModalAddressBookParamList,
        EModalAddressBookRoutes.PickItemModal
      >
    >();
  const { onPick, networkId } = route.params;
  const [searchKey, setSearchKey] = useState<string>('');
  const { isLoading, result } = useAddressBookItems(networkId);
  const navigation = useAppNavigation();

  const onPressItem = useCallback(
    async (item: IAddressItem) => {
      onPick?.(item);
      navigation.pop();
    },
    [onPick, navigation],
  );

  if (isLoading) {
    return <PageLoading />;
  }
  if (!result?.isSafe) {
    return <UnsafeContent />;
  }
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.address_book_select_title,
        })}
        headerSearchBarOptions={{
          placeholder: intl.formatMessage({
            id: ETranslations.address_book_search_placeholder,
          }),
          onChangeText(e) {
            setSearchKey(e.nativeEvent.text);
          },
        }}
      />
      <Page.Body px="$4">
        <AddressBookListContent
          onPressItem={onPressItem}
          items={result?.items ?? []}
          searchKey={searchKey.trim()}
          hideEmptyAddButton
        />
      </Page.Body>
    </Page>
  );
};

export default PickItemPage;
