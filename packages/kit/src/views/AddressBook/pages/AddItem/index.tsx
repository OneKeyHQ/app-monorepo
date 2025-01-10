import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAddressBookRoutes,
  IModalAddressBookParamList,
} from '@onekeyhq/shared/src/routes/addressBook';

import { CreateOrEditContent } from '../../components/CreateOrEditContent';

import type { IAddressItem } from '../../type';
import type { RouteProp } from '@react-navigation/core';

const defaultValues: IAddressItem = {
  name: '',
  address: '',
  networkId: getNetworkIdsMap().btc,
  isAllowListed: false,
};

const AddItemPage = () => {
  const intl = useIntl();
  const appNavigation = useAppNavigation();
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
        await backgroundApiProxy.serviceAddressBook.addItem(item);
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.address_book_add_address_toast_add_success,
          }),
        });
        appNavigation.pop();
        route?.params.onConfirm?.();
      } catch (e) {
        Toast.error({ title: (e as Error).message });
      }
    },
    [appNavigation, intl, route?.params],
  );
  const item = useMemo(
    () => ({ ...defaultValues, ...route.params }),
    [route.params],
  );
  return (
    <CreateOrEditContent
      title={intl.formatMessage({
        id: ETranslations.address_book_add_address_title,
      })}
      onSubmit={onSubmit}
      item={item}
    />
  );
};

export default AddItemPage;
