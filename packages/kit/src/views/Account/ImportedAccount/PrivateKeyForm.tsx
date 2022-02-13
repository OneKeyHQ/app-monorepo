import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Form, useForm } from '@onekeyhq/components';
import FormChainSelector from '@onekeyhq/kit/src/components/Form/ChainSelector';

type PrivateKeyFormValues = {
  network: string;
  name: string;
  privateKey: string;
};

const PrivateKeyForm: FC = () => {
  const intl = useIntl();
  const { control } = useForm<PrivateKeyFormValues>();
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
          name="privateKey"
          label={intl.formatMessage({ id: 'form__private_key' })}
          control={control}
          helpText={intl.formatMessage({ id: 'form__private_key_helperText' })}
        >
          <Form.Textarea />
        </Form.Item>
      </Form>
    </Box>
  );
};

export default PrivateKeyForm;
