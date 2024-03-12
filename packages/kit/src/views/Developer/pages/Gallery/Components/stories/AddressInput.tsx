import type { ComponentProps, FC } from 'react';
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
  type IAddressInputValue,
} from '@onekeyhq/kit/src/components/AddressInput';

import { Layout } from './utils/Layout';

type IAddressFormValues = {
  name: string;
  address: IAddressInputValue;
};

const pluginsOptions = { 'clipboard': true, 'contacts': true, 'scan': true };

type IAddressInputTestComponentProps = {
  plugins?: ComponentProps<typeof AddressInput>['plugins'];
};

const TestComponent: FC<IAddressInputTestComponentProps> = ({ plugins }) => {
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
            plugins={plugins}
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
            <TestComponent />
          </Stack>
        ),
      },
      {
        title: 'AddressInput With AddressBook',
        element: (
          <Stack space="$4">
            <TestComponent plugins={pluginsOptions} />
          </Stack>
        ),
      },
    ]}
  />
);

export default AddressInputGallery;
