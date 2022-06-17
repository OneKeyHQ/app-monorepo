import React, { useCallback, useEffect } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Form, Modal, useForm } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import AddressInput from '../../../components/AddressInput';
import { useDebounce } from '../../../hooks';
import { AddressBookRoutes, AddressBookRoutesParams } from '../routes';

type RouteProps = RouteProp<
  AddressBookRoutesParams,
  AddressBookRoutes.EnterAddressRoute
>;

type EnterAddressValues = {
  address: string;
  name?: string;
};

const EnterAddress = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const {
    control,
    watch,
    trigger,
    setError,
    setValue,
    handleSubmit,
    formState: { isValid },
  } = useForm<EnterAddressValues>({
    defaultValues: { address: '' },
    mode: 'onChange',
  });
  const route = useRoute<RouteProps>();
  const { onSelected, networkId } = route.params ?? {};
  const watchedAddress = useDebounce(watch('address'), 300);
  useEffect(() => {
    async function validateAddress() {
      if (watchedAddress && networkId) {
        try {
          await backgroundApiProxy.validator.validateAddress(
            networkId,
            watchedAddress.trim(),
          );
          trigger('address');
        } catch {
          setError('address', {
            message: intl.formatMessage({ id: 'form__address_invalid' }),
          });
        }
      }
    }
    validateAddress();
  }, [watchedAddress, networkId, trigger, setError, intl]);

  const onPress = useCallback(
    (values: EnterAddressValues) => {
      onSelected?.({ address: values.address, name: values.name });
      navigation.goBack();
    },
    [navigation, onSelected],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'form__enter_address' })}
      hideSecondaryAction
      primaryActionTranslationId="action__confirm"
      primaryActionProps={{
        isDisabled: !isValid,
        onPress: () => handleSubmit(onPress)(),
      }}
    >
      <Form.Item
        control={control}
        name="address"
        rules={{
          required: {
            value: true,
            message: intl.formatMessage({
              id: 'form__field_is_required',
            }),
          },
        }}
      >
        <AddressInput
          networkId={networkId}
          onChangeAddressName={(name) => setValue('name', name)}
          plugins={['contact', 'paste', 'scan']}
        />
      </Form.Item>
    </Modal>
  );
};

export default EnterAddress;
