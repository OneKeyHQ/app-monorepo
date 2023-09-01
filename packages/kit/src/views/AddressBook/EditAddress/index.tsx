import { useCallback } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { ToastManager } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNetworks } from '../../../hooks/redux';
import { refreshContacts } from '../../../store/reducers/refresher';
import AddressBookModalView from '../components/AddressBookModalView';

import type {
  AddressBookRoutes,
  AddressBookRoutesParams,
  ContactValues,
} from '../routes';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  AddressBookRoutesParams,
  AddressBookRoutes.EditAddressRoute
>;

const EditAddress = () => {
  const intl = useIntl();

  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const networks = useNetworks();
  const { defaultValues, uuid } = route.params;
  const onSubmit = useCallback(
    async (values: ContactValues) => {
      const net = networks.find((network) => network.id === values.networkId);
      if (net) {
        await backgroundApiProxy.serviceAddressbook.updateItem(uuid, {
          name: values.name,
          address: values.address,
          badge: net.impl,
          networkId: net.id,
        });
        backgroundApiProxy.dispatch(refreshContacts());
        backgroundApiProxy.serviceCloudBackup.requestBackup();
        ToastManager.show({
          title: intl.formatMessage({ id: 'msg__address_changed' }),
        });
        navigation.goBack();
      }
    },
    [networks, navigation, uuid, intl],
  );
  return (
    <AddressBookModalView
      defaultValues={{
        address: defaultValues.address,
        name: defaultValues.name,
        networkId: defaultValues.networkId,
      }}
      onSubmit={onSubmit}
      header={intl.formatMessage({ id: 'title__edit_address' })}
      primaryActionTranslationId="action__save"
      editing
    />
  );
};

export default EditAddress;
