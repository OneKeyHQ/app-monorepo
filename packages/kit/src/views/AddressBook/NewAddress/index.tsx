import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { useToast } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../hooks';
import { useRuntime } from '../../../hooks/redux';
import { create } from '../../../store/reducers/contacts';
import AddressBookModalView from '../components/AddressBookModalView';
import { ContactValues } from '../routes';

const NewAddress = () => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation();
  const { networks } = useRuntime();
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
          toast.show({
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
        navigation.goBack();
      }
    },
    [networks, navigation, intl, toast],
  );
  return (
    <AddressBookModalView
      defaultValues={{ address: '', name: '' }}
      onSubmit={onSubmit}
      header={intl.formatMessage({ id: 'action__add_new_address' })}
      showAlert
      primaryActionTranslationId="action__add"
    />
  );
};

export default NewAddress;
