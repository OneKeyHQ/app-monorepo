import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { CreateOrEditContent } from '../../components/CreateOrEditContent';

import type { IAddressItem } from '../../type';

const defaultValues: IAddressItem = {
  name: '',
  address: '',
  networkId: getNetworkIdsMap().btc,
};

const AddItemPage = () => {
  const intl = useIntl();
  const appNavigation = useAppNavigation();
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
      } catch (e) {
        Toast.error({ title: (e as Error).message });
      }
    },
    [appNavigation, intl],
  );
  return (
    <CreateOrEditContent
      title={intl.formatMessage({
        id: ETranslations.address_book_add_address_title,
      })}
      onSubmit={onSubmit}
      item={defaultValues}
    />
  );
};

export default AddItemPage;
