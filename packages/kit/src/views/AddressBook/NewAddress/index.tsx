import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../hooks';
import { useRuntime } from '../../../hooks/redux';
import { create } from '../../../store/reducers/contacts';
import AddressBookModalView from '../components/AddressBookModalView';
import { ContactValues } from '../routes';

const NewAddress = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { networks } = useRuntime();
  const onSubmit = useCallback(
    (values: ContactValues) => {
      const net = networks.find((network) => network.id === values.networkId);
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
    [networks, navigation],
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
