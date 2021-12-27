import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Form, useForm } from '@onekeyhq/components';

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
