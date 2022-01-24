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
  onClose: () => void;
};

type NavigationProps = NativeStackNavigationProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.RecoveryAccountForm
>;

const CreateAccount: FC<CreateAccountProps> = ({ onClose }) => {
  const intl = useIntl();
  const { control } = useForm<PrivateKeyFormValues>();
  const navigation = useNavigation<NavigationProps>();
  return (
    <Modal
      header={intl.formatMessage({ id: 'action__add_account' })}
      headerDescription={`${intl.formatMessage({ id: 'wallet__wallet' })}#2`}
      onClose={onClose}
      primaryActionTranslationId="action__create"
      hideSecondaryAction
      scrollViewProps={{
        children: (
          <>
            <Form w="full" zIndex={999} h="full">
              <Form.Item
                name="network"
                control={control}
                label={intl.formatMessage({ id: 'network__network' })}
                helpText={intl.formatMessage({
                  id: 'form__network_helperText',
                })}
                defaultValue="https://rpc.onekey.so/eth"
                formControlProps={{ zIndex: 999 }}
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
              <Box alignItems="center" mt="6">
                <Typography.Body1>
                  {intl.formatMessage({
                    id: 'account__restore_a_previously_used_account',
                  })}
                </Typography.Body1>
                <Typography.Body1
                  onPress={() =>
                    navigation.navigate(ModalRoutes.RecoveryAccountForm)
                  }
                >
                  {intl.formatMessage({
                    id: 'action__recover_accounts',
                  })}
                </Typography.Body1>
              </Box>
            </Form>
          </>
        ),
      }}
    />
  );
};

export default CreateAccount;
