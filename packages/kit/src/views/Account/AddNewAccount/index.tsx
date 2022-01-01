/* eslint-disable @typescript-eslint/no-shadow */
import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Form, Modal, Typography, useForm } from '@onekeyhq/components';
import {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
  ModalRoutes,
} from '@onekeyhq/kit/src/routes';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type PrivateKeyFormValues = {
  network: string;
  name: string;
};

type CreateAccountProps = {
  visible: boolean;
  onClose: () => void;
};

type NavigationProps = NativeStackNavigationProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.RecoveryAccountForm
>;

const CreateAccount: FC<CreateAccountProps> = ({ visible, onClose }) => {
  const intl = useIntl();
  const { control } = useForm<PrivateKeyFormValues>();
  const navigation = useNavigation<NavigationProps>();
  return (
    <Modal
      visible={visible}
      header={intl.formatMessage({ id: 'wallet__watched_accounts' })}
      onClose={onClose}
      primaryActionTranslationId="action__create"
      onPrimaryActionPress={() =>
        navigation.navigate(ModalRoutes.RecoveryAccountForm)
      }
      hideSecondaryAction
    >
      <Box
        w="full"
        display="flex"
        flex="1"
        flexDirection="row"
        justifyContent="center"
        zIndex={999}
      >
        <Form w="full" zIndex={999}>
          <Form.Item
            name="network"
            control={control}
            label={intl.formatMessage({ id: 'network__network' })}
            helpText={intl.formatMessage({ id: 'form__network_helperText' })}
            defaultValue="https://rpc.onekey.so/eth"
            formControlProps={{ zIndex: 999, maxW: '80' }}
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
        </Form>
      </Box>
      <Box alignItems="center">
        <Typography.Body1>
          {intl.formatMessage({
            id: 'account__restore_a_previously_used_account',
          })}
        </Typography.Body1>
        <Typography.Body1>
          {intl.formatMessage({
            id: 'action__recover_accounts',
          })}
        </Typography.Body1>
      </Box>
    </Modal>
  );
};

export default CreateAccount;
