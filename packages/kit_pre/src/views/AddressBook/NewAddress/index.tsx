import { useCallback } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { ToastManager } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNetworks } from '../../../hooks/redux';
import { create } from '../../../store/reducers/contacts';
import AddressBookModalView from '../components/AddressBookModalView';

import type {
  AddressBookRoutes,
  AddressBookRoutesParams,
  ContactValues,
} from '../routes';
import type { RouteProp } from '@react-navigation/core';

type NewAddressRouteProp = RouteProp<
  AddressBookRoutesParams,
  AddressBookRoutes.NewAddressRoute
>;
const NewAddress = () => {
  const intl = useIntl();

  const navigation = useNavigation();
  const route = useRoute<NewAddressRouteProp>();
  const { address = '' } = route.params || {};
  const networks = useNetworks();
  const onSubmit = useCallback(
    async (values: ContactValues) => {
      const net = networks.find((network) => network.id === values.networkId);
      if (values.networkId) {
        try {
          await backgroundApiProxy.validator.validateAddress(
            values.networkId,
            values.address,
          );
        } catch {
          ToastManager.show({
            title: intl.formatMessage({ id: 'form__address_invalid' }),
          });
          return;
        }
      }
      if (net) {
        backgroundApiProxy.dispatch(
          create({
            name: values.name,
            address: values.address,
            badge: net.impl,
            networkId: net.id,
          }),
        );
        backgroundApiProxy.serviceCloudBackup.requestBackup();
        ToastManager.show(
          {
            title: intl.formatMessage({ id: 'msg__address_added' }),
          },
          {},
        );
        navigation.goBack();
      }
    },
    [networks, navigation, intl],
  );
  return (
    <AddressBookModalView
      defaultValues={{ address, name: '' }}
      onSubmit={onSubmit}
      header={intl.formatMessage({ id: 'action__add_new_address' })}
      showAlert
      primaryActionTranslationId="action__add"
    />
  );
};

export default NewAddress;
