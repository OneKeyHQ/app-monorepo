import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAddressBookRoutes,
  IModalAddressBookParamList,
} from '@onekeyhq/shared/src/routes/addressBook';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';

import { CreateOrEditContent } from '../../components/CreateOrEditContent';

import type { IAddressItem } from '../../type';
import type { RouteProp } from '@react-navigation/core';

const defaultValues: IAddressItem = {
  name: '',
  address: '',
  networkId: getNetworkIdsMap().btc,
  isAllowListed: false,
};

function EditItemPage() {
  const intl = useIntl();
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const navigation = useAppNavigation();
  const { params: addressBookParams } =
    useRoute<
      RouteProp<
        IModalAddressBookParamList,
        EModalAddressBookRoutes.EditItemModal
      >
    >();

  const isCreateMode = !addressBookParams?.id;

  const onSubmit = useCallback(
    async (item: IAddressItem) => {
      const { serviceAddressBook } = backgroundApiProxy;
      try {
        setIsSubmitLoading(true);
        if (item.id) {
          item.updatedAt = Date.now();
          await serviceAddressBook.updateItem(item);
        } else {
          item.createdAt = Date.now();
          item.updatedAt = Date.now();
          await serviceAddressBook.addItem(item);
        }
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.address_book_add_address_toast_save_success,
          }),
        });
        appEventBus.emit(EAppEventBusNames.AddressBookUpdate, undefined);
        navigation.pop();
      } catch (e) {
        Toast.error({ title: (e as Error).message });
      } finally {
        setIsSubmitLoading(false);
      }
    },
    [intl, navigation],
  );

  const onRemove = useCallback(
    async (item: IAddressItem) => {
      Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.address_book_edit_address_delete_contact_title,
        }),
        icon: 'DeleteOutline',
        description: intl.formatMessage({
          id: ETranslations.address_book_edit_address_delete_contact_message,
        }),
        tone: 'destructive',
        showConfirmButton: true,
        showCancelButton: true,
        onConfirm: async () => {
          if (item.id) {
            try {
              await backgroundApiProxy.serviceAddressBook.removeItem(item.id);
              Toast.success({
                title: intl.formatMessage({
                  id: ETranslations.address_book_add_address_toast_delete_success,
                }),
              });
              appEventBus.emit(EAppEventBusNames.AddressBookUpdate, undefined);
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
    [navigation, intl],
  );

  const { result: item, isLoading } = usePromiseResult(
    async () => {
      if (isCreateMode) {
        return { ...defaultValues, ...addressBookParams };
      }
      const { password } =
        await backgroundApiProxy.servicePassword.promptPasswordVerify();
      if (!password) {
        throw new OneKeyLocalError('No password');
      }
      const addressBookItem =
        await backgroundApiProxy.serviceAddressBook.findItemById({
          id: addressBookParams.id,
          password,
        });
      return {
        ...addressBookItem,
        ...addressBookParams,
      };
    },
    [addressBookParams, isCreateMode],
    {
      initResult: {
        address: '',
        name: '',
        networkId: '',
      },
      watchLoading: true,
    },
  );

  // isLoading is undefined initially, so we need to explicitly check if it's false
  return isLoading === false ? (
    <CreateOrEditContent
      isSubmitLoading={isSubmitLoading}
      title={intl.formatMessage({
        id: isCreateMode
          ? ETranslations.address_book_add_address_title
          : ETranslations.address_book_edit_address_title,
      })}
      disabledAddressEdit={!isCreateMode}
      item={item}
      onSubmit={onSubmit}
      onRemove={isCreateMode ? undefined : onRemove}
      nameHistoryInfo={
        !isCreateMode && item?.id
          ? {
              entityId: item.id,
              entityType: EChangeHistoryEntityType.AddressBook,
              contentType: EChangeHistoryContentType.Name,
            }
          : undefined
      }
    />
  ) : null;
}

export default EditItemPage;
