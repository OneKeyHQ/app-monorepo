/* eslint-disable @typescript-eslint/no-shadow */
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Alert,
  Box,
  Form,
  Modal,
  Typography,
  useForm,
  useToast,
} from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';
import { useIsVerticalLayout } from '@onekeyhq/components/src/Provider/hooks';
import { Text } from '@onekeyhq/components/src/Typography';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import FormChainSelector from '@onekeyhq/kit/src/components/Form/ChainSelector';
import { useHelpLink } from '@onekeyhq/kit/src/hooks';
import { useGeneral, useRuntime } from '@onekeyhq/kit/src/hooks/redux';
import {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '@onekeyhq/kit/src/routes';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';

type PrivateKeyFormValues = {
  network: string;
  name: string;
  addressType: string;
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
  const { dispatch, serviceAccount } = backgroundApiProxy;
  const { control, handleSubmit, getValues, setValue, watch } =
    useForm<PrivateKeyFormValues>({
      defaultValues: { name: '', addressType: 'default' },
    });
  const { activeNetworkId } = useGeneral();

  const navigation = useNavigation<NavigationProps['navigation']>();
  const route = useRoute<RouteProps>();
  const { wallets, networks } = useRuntime();

  const isSmallScreen = useIsVerticalLayout();

  const {
    walletId: selectedWalletId,
    selectedNetworkId,
    onLoadingAccount,
  } = route.params;

  const wallet = useMemo(
    () => wallets.find((wallet) => wallet.id === selectedWalletId),
    [selectedWalletId, wallets],
  );

  const watchAddressType = watch('addressType');
  const selectableNetworks = useMemo(
    () =>
      networks
        .filter((network) => {
          if (wallet?.type === 'hw') {
            return network.settings.hardwareAccountEnabled;
          }
          if (wallet?.type === 'imported') {
            return network.settings.importedAccountEnabled;
          }
          if (wallet?.type === 'watching') {
            return network.settings.watchingAccountEnabled;
          }
          return true;
        })
        .map((network) => network.id),
    [networks, wallet],
  );
  const watchNetwork = watch(
    'network',
    [selectedNetworkId, activeNetworkId].filter((networkId) =>
      selectableNetworks.includes(networkId || ''),
    )[0] || selectableNetworks[0],
  );
  useEffect(() => {
    setValue('network', watchNetwork);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const selectedNetwork = useMemo(
    () =>
      networks?.find(
        ({ id }) =>
          id ===
          (selectableNetworks.includes(watchNetwork)
            ? watchNetwork
            : selectableNetworks[0]),
      ),
    [networks, selectableNetworks, watchNetwork],
  );
  const [purpose, setPurpose] = useState(44);
  const [cannotCreateAccountReason, setCannotCreateAccountReason] =
    useState('');
  const addressTypeOptions = useMemo(() => {
    const ret = [];
    if (selectedNetwork) {
      for (const [key, value] of Object.entries(
        selectedNetwork.accountNameInfo,
      )) {
        ret.push({ label: value.label || '', value: key });
      }
    }
    return ret.length > 1 ? ret : [];
  }, [selectedNetwork]);

  useEffect(() => {
    async function setNameAndCheck() {
      if (selectedNetwork) {
        const { prefix, category } =
          selectedNetwork.accountNameInfo[watchAddressType] ||
          selectedNetwork.accountNameInfo.default;
        if (typeof prefix !== 'undefined') {
          const id = wallet?.nextAccountIds?.[category] || 0;
          setValue('name', `${prefix} #${id + 1}`);
          const usedPurpose = parseInt(category.split("'/")[0]);
          setPurpose(usedPurpose);
          try {
            await backgroundApiProxy.validator.validateCanCreateNextAccount(
              selectedWalletId,
              selectedNetwork.id,
              usedPurpose,
            );
            setCannotCreateAccountReason('');
          } catch ({ key, info }) {
            setCannotCreateAccountReason(
              intl.formatMessage({ id: key as any }, info as any),
            );
          }
          return;
        }
      }
      setCannotCreateAccountReason(
        intl.formatMessage({ id: 'msg__unknown_error' }),
      );
    }

    setNameAndCheck();
  }, [
    intl,
    wallet,
    selectedWalletId,
    selectedNetwork,
    watchAddressType,
    setValue,
    setPurpose,
  ]);

  const addressTypeHelpLink = useHelpLink({ path: 'articles/360002057776' });
  const onAddressTypeHelpLinkPressed = useCallback(() => {
    const title = intl.formatMessage({ id: 'title__help_center' });
    openUrl(addressTypeHelpLink, title);
  }, [addressTypeHelpLink, intl]);

  const authenticationDone = useCallback(
    (password: string) => {
      const network = getValues('network');
      const name = getValues('name');
      onLoadingAccount?.(selectedWalletId, network);
      setTimeout(() => {
        serviceAccount
          .addHDAccounts(
            password,
            selectedWalletId,
            network,
            undefined,
            [name],
            purpose,
          )
          .catch((e) => {
            console.error(e);
            const errorKey = (e as { key: LocaleIds }).key;
            toast.show({
              title: intl.formatMessage({ id: errorKey }),
            });
          })
          .finally(() => {
            onLoadingAccount?.(selectedWalletId);
          });
      }, 10);
      navigation.getParent()?.goBack?.();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toast, getValues, selectedWalletId, purpose, dispatch, intl, networks],
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
      headerDescription={`${
        wallet?.name ?? intl.formatMessage({ id: 'wallet__wallet' })
      }`}
      onClose={onClose}
      primaryActionProps={{
        onPromise: onSubmit,
        isDisabled: !!cannotCreateAccountReason,
      }}
      primaryActionTranslationId="action__create"
      hideSecondaryAction
      scrollViewProps={{
        children: (
          <Form w="full" zIndex={999} h="full">
            <FormChainSelector
              selectableNetworks={selectableNetworks}
              control={control}
              name="network"
            />
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
            {addressTypeOptions.length <= 1 ? undefined : (
              <Form.Item
                name="addressType"
                label={intl.formatMessage({ id: 'form__address_type_label' })}
                control={control}
                labelAddon={
                  <Pressable
                    color="text-subdued"
                    _hover={{ color: 'text-default' }}
                    onPress={onAddressTypeHelpLinkPressed}
                  >
                    <Typography.Body2Strong underline>
                      Learn More
                    </Typography.Body2Strong>
                  </Pressable>
                }
              >
                <Form.Select
                  headerShown={false}
                  footer={null}
                  defaultValue="default"
                  options={addressTypeOptions}
                />
              </Form.Item>
            )}
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
                          {
                            walletId: selectedWalletId,
                            network,
                            password,
                            purpose,
                          },
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
            {cannotCreateAccountReason.length === 0 ? undefined : (
              <Alert
                title={cannotCreateAccountReason}
                dismiss={false}
                alertType="info"
              />
            )}
          </Form>
        ),
      }}
    />
  );
};

export default CreateAccount;
