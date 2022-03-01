/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-shadow */
import React, { FC, useMemo } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Form, Modal, useForm } from '@onekeyhq/components';
import FormChainSelector from '@onekeyhq/kit/src/components/Form/ChainSelector';
import Protected from '@onekeyhq/kit/src/components/Protected';
import {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '@onekeyhq/kit/src/routes';

import { useAppSelector } from '../../../hooks/redux';

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

type RouteProps = RouteProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.CreateAccountForm
>;

const CreateAccount: FC<CreateAccountProps> = ({ onClose }) => {
  const intl = useIntl();
  const { control, handleSubmit } = useForm<PrivateKeyFormValues>({
    defaultValues: { name: '' },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const wallets = useAppSelector((s) => s.wallet.wallets);
  const selectedWalletId = route.params.walletId;
  const defaultWalletName = useMemo(() => {
    const wallet = wallets.find((wallet) => wallet.id === selectedWalletId);

    const id = wallet?.nextAccountIds?.global;
    if (!id) return '';
    return `Account #${id}`;
  }, [wallets, selectedWalletId]);

  const onSubmit = handleSubmit((data) => {
    console.log('----data', data);
  });

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__add_account' })}
      headerDescription={`${intl.formatMessage({ id: 'wallet__wallet' })}`}
      onClose={onClose}
      primaryActionProps={{ onPromise: onSubmit }}
      primaryActionTranslationId="action__create"
      hideSecondaryAction
      scrollViewProps={{
        children: (
          <Form w="full" zIndex={999} h="full">
            <FormChainSelector control={control} name="network" />
            <Form.Item
              name="name"
              rules={{
                required: intl.formatMessage({
                  id: 'form__field_is_required',
                }),
                maxLength: {
                  value: 24,
                  message: intl.formatMessage({
                    id: 'msg__exceeding_the_maximum_word_limit',
                  }),
                },
              }}
              label={intl.formatMessage({ id: 'form__account_name' })}
              control={control}
            >
              <Form.Input placeholder={defaultWalletName} />
            </Form.Item>
            {/* <Box alignItems="center" mt="6">
                <Typography.Body1>
                  {intl.formatMessage({
                    id: 'account__restore_a_previously_used_account',
                  })}
                </Typography.Body1>
                <Typography.Body1
                  onPress={() =>
                    // TODO
                  }
                >
                  {intl.formatMessage({
                    id: 'action__recover_accounts',
                  })}
                </Typography.Body1>
              </Box> */}
          </Form>
        ),
      }}
    />
  );
};

export default CreateAccount;
