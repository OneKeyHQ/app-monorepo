import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Form, useForm } from '@onekeyhq/components';

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
        <Form.Item
          name="network"
          control={control}
          label={intl.formatMessage({ id: 'network__network' })}
          helpText={intl.formatMessage({ id: 'form__network_helperText' })}
          defaultValue="https://rpc.onekey.so/eth"
          formControlProps={{ zIndex: 10, maxW: '80' }}
        >
          <Form.Select
            title={intl.formatMessage({ id: 'network__network' })}
            footer={null}
            containerProps={{
              zIndex: 999,
              padding: 0,
            }}
            triggerProps={{
              py: 2,
            }}
            options={[
              {
                label: 'https://google.com',
                value: 'https://google.com',
              },
              {
                label: 'https://rpc.onekey.so/eth',
                value: 'https://rpc.onekey.so/eth',
              },
              {
                label: 'https://baidu.com',
                value: 'https://baidu.com',
              },
            ]}
          />
        </Form.Item>
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
