import { useCallback, useEffect } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Form, Modal, ToastManager, useForm } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import AddressInput from '../../../components/AddressInput';
import { useDebounce } from '../../../hooks';

import type { AddressBookRoutes, AddressBookRoutesParams } from '../routes';
import type { RouteProp } from '@react-navigation/native';

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
  const route = useRoute<RouteProps>();
  const { onSelected, networkId, defaultAddress } = route.params ?? {};
  const {
    control,
    watch,
    trigger,
    setError,
    setValue,
    handleSubmit,
    formState: { isValid },
  } = useForm<EnterAddressValues>({
    defaultValues: { address: defaultAddress ?? '' },
    mode: 'onChange',
  });
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
    async (values: EnterAddressValues) => {
      if (networkId) {
        try {
          await backgroundApiProxy.validator.validateAddress(
            networkId,
            values.address.trim(),
          );
        } catch {
          ToastManager.show({
            title: intl.formatMessage({ id: 'form__address_invalid' }),
          });
          return;
        }
      }
      onSelected?.({ address: values.address.trim(), name: values.name });
      navigation.goBack();
    },
    [navigation, onSelected, intl, networkId],
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
