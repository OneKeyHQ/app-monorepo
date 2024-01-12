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
} from '@onekeyhq/kit/src/common/components/AddressInput';

import { Layout } from './utils/Layout';

type IAddressFormValues = {
  name: string;
  address: IAddressInputValue;
};

const TestComponent = () => {
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
              if (!value.resolved) {
                return intl.formatMessage({ id: 'form__address_invalid' });
              }
              return undefined;
            },
          }}
        >
          <AddressInput networkId="evm--1" enableAddressBook />
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
            <TestComponent />
          </Stack>
        ),
      },
    ]}
  />
);

export default AddressInputGallery;
