import { useCallback } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { useToast } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useRuntime } from '../../../hooks/redux';
import { update } from '../../../store/reducers/contacts';
import AddressBookModalView from '../components/AddressBookModalView';
import {
  AddressBookRoutes,
  AddressBookRoutesParams,
  ContactValues,
} from '../routes';

type RouteProps = RouteProp<
  AddressBookRoutesParams,
  AddressBookRoutes.EditAddressRoute
>;

const EditAddress = () => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { networks } = useRuntime();
  const { defaultValues, uuid } = route.params;
  const onSubmit = useCallback(
    (values: ContactValues) => {
      const net = networks.find((network) => network.id === values.networkId);
      if (net) {
        backgroundApiProxy.dispatch(
          update({
            uuid,
            contact: {
              name: values.name,
              address: values.address,
              badge: net.impl,
              networkId: net.id,
            },
          }),
        );
        backgroundApiProxy.serviceCloudBackup.requestBackup();
        toast.show({
          title: intl.formatMessage({ id: 'msg__address_changed' }),
        });
        navigation.goBack();
      }
    },
    [networks, navigation, uuid, toast, intl],
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
