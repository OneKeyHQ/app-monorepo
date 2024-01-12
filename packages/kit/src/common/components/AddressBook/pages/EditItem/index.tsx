import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  EModalAddressBookRoutes,
  IModalAddressBookParamList,
} from '@onekeyhq/kit/src/common/components/AddressBook/router/types';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

import { CreateOrEditContent } from '../../components/CreateOrEditContent';

import type { IAddressItem } from '../../type';
import type { RouteProp } from '@react-navigation/core';

const EditItemPage = () => {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<
        IModalAddressBookParamList,
        EModalAddressBookRoutes.EditItemModal
      >
    >();

  const onSubmit = useCallback(
    async (item: IAddressItem) => {
      await backgroundApiProxy.serviceAddressBook.editAddressBookItem(item);
      navigation.pop();
    },
    [navigation],
  );

  const onRemove = useCallback(
    async (item: IAddressItem) => {
      if (item.id) {
        await backgroundApiProxy.serviceAddressBook.removeAddressBookItem(
          item.id,
        );
      }
      navigation.pop();
    },
    [navigation],
  );

  return (
    <CreateOrEditContent
      title={intl.formatMessage({ id: 'title__edit_address' })}
      item={route.params}
      onSubmit={onSubmit}
      onRemove={onRemove}
    />
  );
};

export default EditItemPage;
