/* eslint-disable @typescript-eslint/no-shadow */
import React, { FC, useCallback, useEffect, useMemo } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Form, Modal, useForm } from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';
import { useIsVerticalLayout } from '@onekeyhq/components/src/Provider/hooks';
import { Text } from '@onekeyhq/components/src/Typography';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import FormChainSelector from '@onekeyhq/kit/src/components/Form/ChainSelector';
import { useNavigationActions, useToast } from '@onekeyhq/kit/src/hooks';
import { useRuntime } from '@onekeyhq/kit/src/hooks/redux';
import {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '@onekeyhq/kit/src/routes';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

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
  const toast = useToast();
  const { closeDrawer } = useNavigationActions();
  const { dispatch, serviceAccount } = backgroundApiProxy;
  const { control, handleSubmit, getValues, setValue, watch } =
    useForm<PrivateKeyFormValues>({ defaultValues: { name: '' } });

  const navigation = useNavigation<NavigationProps['navigation']>();
  const route = useRoute<RouteProps>();
  const { wallets, networks } = useRuntime();

  const selectedWalletId = route.params.walletId;
  const wallet = useMemo(
    () => wallets.find((wallet) => wallet.id === selectedWalletId),
    [selectedWalletId, wallets],
  );
  const watchNetwork = watch('network', (networks ?? [])[0].id);
  const isSmallScreen = useIsVerticalLayout();

  useEffect(() => {
    const selectedNetwork =
      networks?.find((n) => n.id === watchNetwork) ?? null;
    if (selectedNetwork) {
      const { prefix, category } = selectedNetwork.accountNameInfo.default;
      if (typeof prefix !== 'undefined') {
        const id = wallet?.nextAccountIds?.[category] || 0;
        setValue('name', `${prefix} #${id + 1}`);
      }
    }
  }, [wallet, networks, watchNetwork, setValue]);

  const authenticationDone = useCallback(
    async (password: string) => {
      const network = getValues('network');
      const name = getValues('name');
      try {
        await serviceAccount.addHDAccounts(
          password,
          selectedWalletId,
          network,
          undefined,
          [name],
        );
      } catch (e) {
        const errorKey = (e as { key: LocaleIds }).key;
        toast.show({
          title: intl.formatMessage({ id: errorKey }),
        });
      }
      closeDrawer();
      if (navigation.canGoBack()) {
        navigation.getParent()?.goBack?.();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toast, getValues, selectedWalletId, dispatch, intl, networks, closeDrawer],
  );

  const onSubmit = handleSubmit(() => {
    navigation.navigate(CreateAccountModalRoutes.CreateAccountAuthentication, {
      walletId: selectedWalletId,
      onDone: authenticationDone,
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
              <Form.Input size={isSmallScreen ? 'xl' : 'default'} />
            </Form.Item>
            <Box alignItems="center">
              <Text
                typography={{ sm: 'Body1', md: 'Body2' }}
                color="text-subdued"
              >
                {intl.formatMessage({
                  id: 'account__restore_a_previously_used_account',
                })}
              </Text>
              <Pressable
                onPress={() => {
                  navigation.navigate(
                    CreateAccountModalRoutes.CreateAccountAuthentication,
                    {
                      walletId: selectedWalletId,
                      onDone: (password) => {
                        const network = getValues('network');
                        navigation.navigate(
                          CreateAccountModalRoutes.RecoverAccountsList,
                          { walletId: selectedWalletId, network, password },
                        );
                      },
                    },
                  );
                }}
              >
                <Text
                  typography={{ sm: 'Body1', md: 'Body2' }}
                  color="action-primary-default"
                >
                  {intl.formatMessage({
                    id: 'action__recover_accounts',
                  })}
                </Text>
              </Pressable>
            </Box>
          </Form>
        ),
      }}
    />
  );
};

export default CreateAccount;
