import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

import { CreateOrEditContent } from '../../components/CreateOrEditContent';

import type { IAddressItem } from '../../type';

const defaultValues: IAddressItem = {
  name: '',
  address: '',
  networkId: 'btc--0',
};

const AddItemPage = () => {
  const intl = useIntl();
  const appNavigation = useAppNavigation();
  const onSubmit = useCallback(
    async (item: IAddressItem) => {
      try {
        await backgroundApiProxy.serviceAddressBook.addAddressBookItem(item);
        appNavigation.pop();
      } catch (e) {
        Toast.error({ title: (e as Error).message, duration: 50000 });
      }
    },
    [appNavigation],
  );
  return (
    <CreateOrEditContent
      title={intl.formatMessage({ id: 'action__add_new_address' })}
      onSubmit={onSubmit}
      item={defaultValues}
    />
  );
};

export default AddItemPage;
