/* eslint-disable @typescript-eslint/no-shadow */
import React, { FC, useMemo } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Form, Modal, Typography, useForm } from '@onekeyhq/components';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import FormChainSelector from '@onekeyhq/kit/src/components/Form/ChainSelector';
import { useAppDispatch, useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '@onekeyhq/kit/src/routes';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';
import { setRefreshTS } from '@onekeyhq/kit/src/store/reducers/settings';

type PrivateKeyFormValues = {
  network: string;
  name: string;
};

type CreateAccountProps = {
  onClose: () => void;
};
type NavigationProps = ModalScreenProps<CreateAccountRoutesParams>;

type RouteProps = RouteProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.CreateAccountForm
>;

const CreateAccount: FC<CreateAccountProps> = ({ onClose }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const { control, handleSubmit, getValues } = useForm<PrivateKeyFormValues>({
    defaultValues: { name: '' },
  });

  const navigation = useNavigation<NavigationProps['navigation']>();
  const route = useRoute<RouteProps>();
  const wallets = useAppSelector((s) => s.wallet.wallets);
  const networks = useAppSelector((s) => s.network.network);
  const selectedWalletId = route.params.walletId;
  const defaultWalletName = useMemo(() => {
    const wallet = wallets.find((wallet) => wallet.id === selectedWalletId);
    const id = wallet?.nextAccountIds?.global;
    if (!id) return '';
    return `Account #${id}`;
  }, [wallets, selectedWalletId]);

  const authenticationDone = (password: string) => {
    async function main() {
      const network = getValues('network');
      const name = getValues('name');
      const account = await backgroundApiProxy.engine.addHDAccount(
        password,
        selectedWalletId,
        network,
        undefined,
        name,
      );
      const wallet = wallets.find((w) => w.id === selectedWalletId) ?? null;
      const selectedNetwork = networks?.find((n) => n.id === network) ?? null;
      dispatch(setRefreshTS());
      setTimeout(() => {
        backgroundApiProxy.serviceAccount.changeActiveAccount({
          account,
          wallet,
        });
        if (selectedNetwork) {
          backgroundApiProxy.serviceNetwork.changeActiveNetwork({
            network: selectedNetwork,
            sharedChainName: selectedNetwork.impl,
          });
        }
      }, 50);

      if (navigation.canGoBack()) {
        navigation.getParent()?.goBack?.();
      }
    }
    main();
  };

  const onSubmit = handleSubmit(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.CreateAccount,
      params: {
        screen: CreateAccountModalRoutes.CreateAccountAuthentication,
        params: {
          onDone: authenticationDone,
        },
      },
    });
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
            <Box alignItems="center" mt="6">
              <Typography.Body2>
                {intl.formatMessage({
                  id: 'account__restore_a_previously_used_account',
                })}
              </Typography.Body2>
              <Pressable
                onPress={() => {
                  navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.CreateAccount,
                    params: {
                      screen:
                        CreateAccountModalRoutes.CreateAccountAuthentication,
                      params: {
                        onDone: (password) => {
                          const network = getValues('network');
                          navigation.navigate(RootRoutes.Modal, {
                            screen: ModalRoutes.CreateAccount,
                            params: {
                              screen:
                                CreateAccountModalRoutes.RecoverAccountsList,
                              params: {
                                walletId: selectedWalletId,
                                network,
                                password,
                              },
                            },
                          });
                        },
                      },
                    },
                  });
                }}
              >
                <Typography.Body2Underline color="action-primary-default">
                  {intl.formatMessage({
                    id: 'action__recover_accounts',
                  })}
                </Typography.Body2Underline>
              </Pressable>
            </Box>
          </Form>
        ),
      }}
    />
  );
};

export default CreateAccount;
