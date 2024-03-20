import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Form,
  Stack,
  Toast,
  YStack,
  useForm,
} from '@onekeyhq/components';
import {
  AddressInput,
  AddressInputAccountSelectorProviderMirror,
  type IAddressInputValue,
} from '@onekeyhq/kit/src/components/AddressInput';

import { Layout } from './utils/Layout';

type IAddressFormValues = {
  name: string;
  address: IAddressInputValue;
};

const Demo1 = () => {
  const intl = useIntl();
  const form = useForm<IAddressFormValues>({
    defaultValues: { name: '', address: { raw: '', resolved: undefined } },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });
  const { handleSubmit } = form;
  const handleConfirm = useCallback((value: IAddressFormValues) => {
    Toast.message({ title: 'Address', message: value.address.resolved ?? '' });
  }, []);

  return (
    <YStack>
      <Form form={form}>
        <Form.Field
          name="address"
          rules={{
            required: 'required',
            validate: (value: IAddressInputValue) => {
              if (value.pending) {
                return;
              }
              if (!value.resolved) {
                return intl.formatMessage({ id: 'form__address_invalid' });
              }
              return undefined;
            },
          }}
        >
          <AddressInput
            networkId="evm--1"
            enableAddressBook
            enableWalletName
            contacts
          />
        </Form.Field>
      </Form>
      <Button mt="$4" onPress={() => handleSubmit(handleConfirm)()}>
        Submit
      </Button>
      <Button
        mt="$4"
        onPress={() => {
          form.setValue(
            'address.raw',
            '0x76f3f64cb3cD19debEE51436dF630a342B736C24',
          );
        }}
      >
        Set Address Value
      </Button>
    </YStack>
  );
};

const Demo2 = ({ networkId, num = 0 }: { networkId: string; num: number }) => {
  const intl = useIntl();
  const form = useForm<IAddressFormValues>({
    defaultValues: { name: '', address: { raw: '', resolved: undefined } },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });
  const { handleSubmit } = form;
  const handleConfirm = useCallback((value: IAddressFormValues) => {
    Toast.message({ title: 'Address', message: value.address.resolved ?? '' });
  }, []);

  return (
    <YStack>
      <Form form={form}>
        <Form.Field
          name="address"
          rules={{
            required: 'required',
            validate: (value: IAddressInputValue) => {
              if (value.pending) {
                return;
              }
              if (!value.resolved) {
                return intl.formatMessage({ id: 'form__address_invalid' });
              }
              return undefined;
            },
          }}
        >
          <AddressInputAccountSelectorProviderMirror networkId={networkId}>
            <AddressInput
              networkId={networkId}
              enableAddressBook
              enableWalletName
              contacts
              accountSelector={{ num }}
            />
          </AddressInputAccountSelectorProviderMirror>
        </Form.Field>
      </Form>
      <Button mt="$4" onPress={() => handleSubmit(handleConfirm)()}>
        Submit
      </Button>
    </YStack>
  );
};

const AddressInputGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'AddressInput',
        element: (
          <Stack space="$4">
            <Demo1 />
          </Stack>
        ),
      },
      {
        title: 'AddressInput With AccountSelector/Contact EVM',
        element: (
          <Stack space="$4">
            <Demo2 networkId="evm--1" num={0} />
          </Stack>
        ),
      },
    ]}
  />
);

export default AddressInputGallery;
