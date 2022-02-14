import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Form, useForm } from '@onekeyhq/components';
import FormChainSelector from '@onekeyhq/kit/src/components/Form/ChainSelector';

type KeyStoreFormValues = {
  network: string;
  name: string;
  keystore: string;
  password: string;
};

const KeyStoreForm: FC = () => {
  const intl = useIntl();
  const { control } = useForm<KeyStoreFormValues>();
  return (
    <Box
      w="full"
      display="flex"
      flex="1"
      flexDirection="row"
      justifyContent="center"
    >
      <Form w="full">
        <FormChainSelector control={control} name="network" />
        <Form.Item
          name="name"
          label={intl.formatMessage({ id: 'form__account_name' })}
          control={control}
        >
          <Form.Input />
        </Form.Item>
        <Form.Item
          name="keystore"
          label={intl.formatMessage({ id: 'form__keystore' })}
          control={control}
          helpText={intl.formatMessage({ id: 'form__keystore_helperText' })}
        >
          <Form.Textarea />
        </Form.Item>
        <Form.Item
          name="password"
          label={intl.formatMessage({ id: 'form__password' })}
          helpText={intl.formatMessage({ id: 'form__password_helperText' })}
          control={control}
        >
          <Form.Input />
        </Form.Item>
      </Form>
    </Box>
  );
};

export default KeyStoreForm;
