import React, { FC, ReactElement } from 'react';

import { useIntl } from 'react-intl';

import { Box, Form, Modal, useForm } from '@onekeyhq/components';

type PrivateKeyFormValues = {
  network: string;
  name: string;
  address: string;
};

type WatchedAccountProps = {
  trigger: ReactElement<any>;
};

const WatchedAccount: FC<WatchedAccountProps> = ({ trigger }) => {
  const intl = useIntl();
  const { control, handleSubmit } = useForm<PrivateKeyFormValues>();

  return (
    <Modal
      header={intl.formatMessage({ id: 'wallet__watched_accounts' })}
      trigger={trigger}
      primaryActionTranslationId="action__import"
      onPrimaryActionPress={({ onClose }) =>
        handleSubmit((data) => {
          console.log(data);
          onClose?.();
        })
      }
      hideSecondaryAction
    >
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
            name="address"
            label={intl.formatMessage({ id: 'form__address' })}
            control={control}
            helpText={intl.formatMessage({ id: 'form__address_helperText' })}
          >
            <Form.Textarea />
          </Form.Item>
        </Form>
      </Box>
    </Modal>
  );
};

export default WatchedAccount;
