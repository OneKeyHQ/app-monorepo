import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Form, Modal, useForm } from '@onekeyhq/components';
import {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
  ModalRoutes,
} from '@onekeyhq/kit/src/routes';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.RecoveryAccountForm
>;
type PrivateKeyFormValues = {
  network: string;
  name: string;
  address: string;
};

const WatchedAccount: FC = () => {
  const intl = useIntl();
  const { control } = useForm<PrivateKeyFormValues>();
  const navigation = useNavigation<NavigationProps>();
  return (
    <Modal
      header={intl.formatMessage({ id: 'wallet__watched_accounts' })}
      primaryActionTranslationId="action__import"
      onPrimaryActionPress={() =>
        navigation.navigate(ModalRoutes.RecoveryAccountForm)
      }
      hideSecondaryAction
    >
      <Box
        w="full"
        zIndex={999}
        display="flex"
        flex="1"
        flexDirection="row"
        justifyContent="center"
        bg="background-default"
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
