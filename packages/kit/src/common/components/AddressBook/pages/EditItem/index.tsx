import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Dialog, Toast } from '@onekeyhq/components';
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
      Toast.success({ title: 'Save Successful' });
      navigation.pop();
    },
    [navigation],
  );

  const onRemove = useCallback(
    async (item: IAddressItem) => {
      Dialog.show({
        title: 'Delete Contact',
        icon: 'DeleteOutline',
        description:
          'Please confirm whether to delete this contact from the address book. Type "Confirm" to delete.',
        tone: 'destructive',
        onConfirm: async () => {
          if (item.id) {
            await backgroundApiProxy.serviceAddressBook.removeAddressBookItem(
              item.id,
            );
            Toast.success({ title: 'Delete Successful' });
            navigation.pop();
          }
        },
      });
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
