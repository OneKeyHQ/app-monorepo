import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import { Page, Spinner, Stack } from '@onekeyhq/components';
import type {
  EModalAddressBookRoutes,
  IModalAddressBookParamList,
} from '@onekeyhq/kit/src/common/components/AddressBook/router/types';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

import { AddressBookListContent } from '../../components/AddressBookListContent';
import { useAddressBookItems } from '../../hooks/useAddressBook';

import type { IAddressItem } from '../../type';
import type { RouteProp } from '@react-navigation/core';

const PickItemPage = () => {
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
    (item: IAddressItem) => {
      onPick?.(item);
      navigation.pop();
    },
    [onPick, navigation],
  );
  return (
    <Page>
      <Page.Header
        title="Select Address"
        headerSearchBarOptions={{
          placeholder: 'Search',
          onChangeText(e) {
            setSearchKey(e.nativeEvent.text);
          },
        }}
      />
      <Page.Body px="$4">
        {isLoading ? (
          <Stack h="$10" justifyContent="center" alignItems="center">
            <Spinner />
          </Stack>
        ) : (
          <AddressBookListContent
            onPressItem={onPressItem}
            sections={result ?? []}
            searchKey={searchKey.trim()}
          />
        )}
      </Page.Body>
    </Page>
  );
};

export default PickItemPage;
