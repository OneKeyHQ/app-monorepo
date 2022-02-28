import React, { FC, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Form, Modal, useForm, useToast } from '@onekeyhq/components';
import FormChainSelector from '@onekeyhq/kit/src/components/Form/ChainSelector';
import engine from '@onekeyhq/kit/src/engine/EngineProvider';
import { useAppDispatch, useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '@onekeyhq/kit/src/routes';
import {
  changeActiveAccount,
  changeActiveNetwork,
} from '@onekeyhq/kit/src/store/reducers/general';
import { setRefreshTS } from '@onekeyhq/kit/src/store/reducers/settings';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.RecoveryAccountForm
>;
type WatchedAccountFormValues = {
  network: string;
  name: string;
  address: string;
};

const WatchedAccount: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const { control, handleSubmit } = useForm<WatchedAccountFormValues>();
  const wallets = useAppSelector((s) => s.wallet.wallets);
  const networks = useAppSelector((s) => s.network.network);
  const navigation = useNavigation<NavigationProps>();
  const dispatch = useAppDispatch();

  const defaultWalletName = useMemo(() => {
    const walletList = wallets.filter((wallet) => wallet.type === 'watching');
    const wallet = walletList[0];
    const id = wallet?.nextAccountIds?.global;
    if (!id) return '';
    return `Account #${id}`;
  }, [wallets]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      const walletList = wallets.filter((wallet) => wallet.type === 'watching');
      const wallet = walletList[0];
      const createdAccount = await engine.addWatchingAccount(
        data.network,
        data.address,
        data.name || defaultWalletName,
      );

      toast.show({
        title: intl.formatMessage({ id: 'msg__submitted_successfully' }),
      });
      const selectedNetwork = networks?.find(
        (network) => network.id === data.network,
      );
      dispatch(setRefreshTS());
      dispatch(
        changeActiveAccount({
          account: createdAccount,
          wallet,
        }),
      );
      if (selectedNetwork) {
        dispatch(
          changeActiveNetwork({
            network: selectedNetwork,
            sharedChainName: selectedNetwork.impl,
          }),
        );
      }

      navigation.goBack();
    } catch (e) {
      const errorKey = (e as { key: string }).key;
      toast.show({
        title: intl.formatMessage({ id: errorKey }),
      });
    }
  });

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__add_account' })}
      headerDescription={intl.formatMessage({ id: 'wallet__watched_accounts' })}
      primaryActionTranslationId="action__import"
      primaryActionProps={{ onPromise: onSubmit }}
      hideSecondaryAction
      scrollViewProps={{
        children: (
          <Box
            w="full"
            zIndex={999}
            display="flex"
            flex="1"
            flexDirection="row"
            justifyContent="center"
          >
            <Form w="full">
              <FormChainSelector control={control} name="network" />

              <Form.Item
                name="name"
                rules={{
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
              <Form.Item
                labelAddon={['paste']}
                name="address"
                label={intl.formatMessage({ id: 'form__address' })}
                rules={{
                  required: intl.formatMessage({
                    id: 'form__field_is_required',
                  }),
                }}
                control={control}
                helpText={intl.formatMessage({
                  id: 'form__address_helperText',
                })}
              >
                <Form.Textarea />
              </Form.Item>
            </Form>
          </Box>
        ),
      }}
    />
  );
};

export default WatchedAccount;
