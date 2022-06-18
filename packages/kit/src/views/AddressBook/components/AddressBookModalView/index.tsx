import React, { ComponentProps, FC, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Box, Form, Modal, useForm } from '@onekeyhq/components';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import AddressInput from '../../../../components/AddressInput';
import ChainSelector from '../../../../components/Form/ChainSelector';
import { useAppSelector, useDebounce } from '../../../../hooks';
import { ContactValues } from '../../routes';

type ModalViewProps = ComponentProps<typeof Modal> & {
  defaultValues: ContactValues;
  uuid?: number;
  showAlert?: boolean;
  header: string;
  onSubmit: (values: ContactValues) => void;
};

const ModalView: FC<ModalViewProps> = ({
  defaultValues,
  header,
  showAlert,
  onSubmit,
  ...rest
}) => {
  const intl = useIntl();
  const validateAddressError = useRef<boolean>();
  const contacts = useAppSelector((s) => s.contacts.contacts);
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

  const watchedAddress = useDebounce(address, 300);
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
  }, [name, setValue]);

  useEffect(() => {
    if (address.length > 96) {
      setValue('address', address.slice(0, 96));
    }
  }, [address, setValue]);

  return (
    <Modal
      header={header}
      hideSecondaryAction
      primaryActionProps={{
        isDisabled: !isValid,
        onPress: () => handleSubmit(onSubmit)(),
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
                <Form.Input
                  placeholder={intl.formatMessage({
                    id: 'form__enter_address_name',
                  })}
                />
              </Form.Item>
              <Form.Item
                control={control}
                name="address"
                label={intl.formatMessage({ id: 'form__address' })}
                rules={{
                  required: {
                    value: true,
                    message: intl.formatMessage({
                      id: 'form__field_is_required',
                    }),
                  },
                  validate: (value) => {
                    const text = value?.toLowerCase();
                    const defaultValue = defaultValues.address.toLowerCase();
                    if (!text || (defaultValue && text === defaultValue)) {
                      return;
                    }
                    if (contactsMaps.get(text)) {
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
            {showAlert ? (
              <Box mt="6">
                <Alert
                  alertType="info"
                  title={intl.formatMessage({
                    id: 'content__all_addresses_are_stored_locally',
                  })}
                />
              </Box>
            ) : null}
          </Box>
        ),
      }}
      {...rest}
    />
  );
};

export default ModalView;
