import { useCallback, useEffect } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Form, Modal, ToastManager, useForm } from '@onekeyhq/components';
import NameServiceResolver, {
  useNameServiceStatus,
} from '@onekeyhq/kit/src/components/NameServiceResolver';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import AddressInput from '../../../components/AddressInput';
import { useDebounce } from '../../../hooks';

import type { SwapRoutes, SwapRoutesParams } from '../typings';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<SwapRoutesParams, SwapRoutes.EnterAddress>;

type EnterAddressValues = {
  address: string;
  name?: string;
};

const EnterAddress = () => {
  const intl = useIntl();

  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { onSelected, networkId } = route.params ?? {};
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
  const {
    onChange: onNameServiceStatusChange,
    disableSubmitBtn,
    address,
  } = useNameServiceStatus();
  const debouncedAddress = useDebounce(watch('address'), 300);
  const watchedAddress = address || debouncedAddress;

  useEffect(() => {
    async function validateAddress() {
      if (watchedAddress && networkId) {
        if (disableSubmitBtn) {
          trigger('address');
          return;
        }
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
  }, [watchedAddress, networkId, trigger, setError, intl, disableSubmitBtn]);

  const onPress = useCallback(
    async (values: EnterAddressValues) => {
      if (networkId) {
        try {
          await backgroundApiProxy.validator.validateAddress(
            networkId,
            values.address.trim(),
          );
        } catch {
          ToastManager.show(
            {
              title: intl.formatMessage({ id: 'form__address_invalid' }),
            },
            { type: 'error' },
          );
          return;
        }
      }
      onSelected?.({ address: values.address, name: values.name });
      const parent = navigation.getParent();
      if (parent?.canGoBack()) {
        parent.goBack();
      } else {
        navigation.goBack();
      }
    },
    [navigation, onSelected, networkId, intl],
  );

  const syncStateAndReTriggerValidate = useCallback(
    (val) => {
      onNameServiceStatusChange(val);
      // trigger('address');
    },
    [onNameServiceStatusChange],
  );

  const helpText = useCallback(
    (value: string) => (
      <NameServiceResolver
        name={value}
        onChange={syncStateAndReTriggerValidate}
        networkId={networkId}
      />
    ),
    [networkId, syncStateAndReTriggerValidate],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'form__enter_address' })}
      hideSecondaryAction
      primaryActionTranslationId="action__confirm"
      primaryActionProps={{
        isDisabled: !isValid || disableSubmitBtn,
        onPress: () =>
          handleSubmit((values) => {
            if (!disableSubmitBtn && address) {
              values.address = address;
            }
            onPress(values);
          })(),
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
        helpText={helpText}
      >
        <AddressInput
          networkId={networkId}
          onChangeAddressName={(name) => setValue('name', name)}
          plugins={['paste', 'scan']}
        />
      </Form.Item>
    </Modal>
  );
};

export default EnterAddress;
