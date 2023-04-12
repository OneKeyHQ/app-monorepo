import type { ComponentProps, FC } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  // Alert,
  Box,
  Form,
  Modal,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import NameServiceResolver, {
  useNameServiceStatus,
} from '@onekeyhq/kit/src/components/NameServiceResolver';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import AddressInput from '../../../../components/AddressInput';
import ChainSelector from '../../../../components/Form/ChainSelector';
import { useAppSelector, useDebounce } from '../../../../hooks';
// import { setHideAddressBookAttention } from '../../../../store/reducers/status';

import type { ContactValues } from '../../routes';

type ModalViewProps = ComponentProps<typeof Modal> & {
  defaultValues: ContactValues;
  uuid?: number;
  showAlert?: boolean;
  header: string;
  onSubmit: (values: ContactValues) => void;
  editing?: boolean;
};

const ModalView: FC<ModalViewProps> = ({
  defaultValues,
  header,
  showAlert,
  onSubmit,
  editing,
  ...rest
}) => {
  const intl = useIntl();
  const validateAddressError = useRef<boolean>();
  const contacts = useAppSelector((s) => s.contacts.contacts);
  // const hideAddressBookAttention = useAppSelector(
  //   (s) => s.status.hideAddressBookAttention,
  // );
  const contactsMaps = useMemo(
    () =>
      new Map(Object.values(contacts).map((v) => [v.address.toLowerCase(), v])),
    [contacts],
  );

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { isValid },
  } = useForm<ContactValues>({
    defaultValues,
    mode: 'onChange',
  });

  const name = watch('name');
  const address = watch('address');
  const networkId = watch('networkId');
  const isVerticalLayout = useIsVerticalLayout();

  const {
    onChange: onNameServiceChange,
    disableSubmitBtn,
    address: resolvedAddress,
    name: defaultNameServiceName,
  } = useNameServiceStatus();

  const debouncedAddress = useDebounce(address, 300);
  const watchedAddress = resolvedAddress || debouncedAddress;

  useEffect(() => {
    async function validateAddress() {
      if (watchedAddress && networkId) {
        try {
          await backgroundApiProxy.validator.validateAddress(
            networkId,
            watchedAddress.trim(),
          );
          validateAddressError.current = false;
          trigger('address');
        } catch {
          validateAddressError.current = true;
          trigger('address');
        }
      }
    }
    validateAddress();
  }, [watchedAddress, networkId, trigger, intl]);

  useEffect(() => {
    if (name.length > 24) {
      setValue('name', name.slice(0, 24));
    }
    if (defaultNameServiceName && !name) {
      setValue('name', defaultNameServiceName);
    }
  }, [name, setValue, defaultNameServiceName]);

  useEffect(() => {
    if (address.length > 103) {
      setValue('address', address.slice(0, 103));
    }
  }, [address, setValue]);

  // const onDismiss = useCallback(() => {
  //   backgroundApiProxy.dispatch(setHideAddressBookAttention());
  // }, []);

  const syncStateAndReTriggerValidate = useCallback(
    (val) => {
      onNameServiceChange(val);
      trigger('address');
    },
    [trigger, onNameServiceChange],
  );

  const helpText = useCallback(
    (value: string) => (
      <NameServiceResolver
        name={value}
        onChange={syncStateAndReTriggerValidate}
        disableBTC={false}
        networkId={networkId}
      />
    ),
    [syncStateAndReTriggerValidate, networkId],
  );

  return (
    <Modal
      header={header}
      hideSecondaryAction
      primaryActionProps={{
        isDisabled: !isValid || disableSubmitBtn,
        onPress: () =>
          handleSubmit((vals) => {
            if (!disableSubmitBtn && resolvedAddress) {
              vals.address = resolvedAddress;
            }
            return onSubmit(vals);
          })(),
      }}
      scrollViewProps={{
        children: (
          <Box w="full" h="full">
            <Form>
              <ChainSelector hideHelpText control={control} name="networkId" />
              <Form.Item
                control={control}
                name="name"
                label={intl.formatMessage({ id: 'form__contact_name' })}
                rules={{
                  required: {
                    value: true,
                    message: intl.formatMessage({
                      id: 'form__field_is_required',
                    }),
                  },
                }}
              >
                <Form.Input size={isVerticalLayout ? 'xl' : 'default'} />
              </Form.Item>
              <Form.Item
                control={control}
                name="address"
                label={intl.formatMessage({ id: 'form__address' })}
                helpText={helpText}
                rules={{
                  required: {
                    value: true,
                    message: intl.formatMessage({
                      id: 'form__field_is_required',
                    }),
                  },
                  validate: (value) => {
                    const text =
                      resolvedAddress?.toLowerCase() || value?.toLowerCase();
                    const defaultAddress = defaultValues.address.toLowerCase();
                    if (!text) {
                      return;
                    }
                    if (
                      (!editing && contactsMaps.get(text)) ||
                      (editing &&
                        contactsMaps.get(text) &&
                        text !== defaultAddress)
                    ) {
                      return intl.formatMessage({
                        id: 'msg__this_address_already_exists',
                      });
                    }
                    if (validateAddressError.current) {
                      return intl.formatMessage({
                        id: 'form__address_invalid',
                      });
                    }
                  },
                }}
              >
                <AddressInput />
              </Form.Item>
            </Form>
            {/* {!hideAddressBookAttention ? (
              <Box mt="6">
                <Alert
                  alertType="info"
                  title={intl.formatMessage({
                    id: 'content__all_addresses_are_stored_locally',
                  })}
                  onDismiss={onDismiss}
                />
              </Box>
            ) : null} */}
          </Box>
        ),
      }}
      {...rest}
    />
  );
};

export default ModalView;
