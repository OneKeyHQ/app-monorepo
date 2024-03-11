import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type {
  EModalAddressBookRoutes,
  IModalAddressBookParamList,
} from '@onekeyhq/kit/src/views/AddressBook/router/types';

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
      try {
        await backgroundApiProxy.serviceAddressBook.updateItem(item);
        Toast.success({ title: 'Save Successful' });
        navigation.pop();
      } catch (e) {
        Toast.error({ title: (e as Error).message });
      }
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
        showConfirmButton: true,
        showCancelButton: true,
        onConfirm: async () => {
          if (item.id) {
            try {
              await backgroundApiProxy.serviceAddressBook.removeItem(item.id);
              Toast.success({ title: 'Delete Successful' });
              navigation.pop();
            } catch (e) {
              Toast.error({ title: (e as Error).message });
            }
          }
        },
        confirmButtonProps: {
          testID: 'address-remove-confirm',
        },
        cancelButtonProps: {
          testID: 'address-remove-cancel',
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
