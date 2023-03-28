import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Dialog,
  Divider,
  Form,
  Icon,
  IconButton,
  KeyboardDismissView,
  Modal,
  Pressable,
  Text,
  ToastManager,
  Typography,
  VStack,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount, useDebounce } from '../../../hooks';
import { RpcNodePattern } from '../constants';
import { ManageNetworkModalRoutes } from '../types';

import type { ManageNetworkRoutesParams } from '../types';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RouteProps = RouteProp<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.AddNetwork
>;

type NavigationProps = NativeStackNavigationProp<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.Listing
>;

type NetworkValues = {
  name: string;
  rpcURL: string;
  chainId?: string;
  symbol?: string;
  explorerURL?: string;
};

export type NetworkAddViewProps = undefined;
export type NetworkRpcURLStatus = {
  connected: boolean;
  loading?: boolean;
  speed?: number;
  error?: string;
};

const URITester =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;

export const AddNetwork: FC<NetworkAddViewProps> = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  const route = useRoute<RouteProps>();
  const { network, mode } = route.params;
  const isSmallScreen = useIsVerticalLayout();
  const { network: activeNetwork } = useActiveWalletAccount();
  const [removeOpend, setRemoveOpened] = useState(false);
  const [rpcUrlStatus, setRpcUrlStatus] = useState<NetworkRpcURLStatus>({
    connected: false,
  });

  const { serviceNetwork } = backgroundApiProxy;
  const defaultValues = {
    name: '',
    rpcURL: '',
    chainId: '',
    symbol: '',
    explorerURL: '',
  };
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    trigger,
    formState: { isValid },
  } = useForm<NetworkValues>({
    defaultValues,
    mode: 'onChange',
  });

  const hintText = useMemo(() => {
    if (rpcUrlStatus.error) return '';
    if (rpcUrlStatus.loading) {
      return intl.formatMessage({ id: 'form__rpc_url_connecting' });
    }
    if (rpcUrlStatus.connected) {
      return intl.formatMessage({ id: 'form__rpc_url_fetched' });
    }
  }, [rpcUrlStatus, intl]);

  const watchedRpcURL = useDebounce(watch('rpcURL'), 1000);
  const url = watchedRpcURL?.trim();

  useEffect(() => {
    if (!network) {
      return;
    }
    const { name, rpcURL, symbol, explorerURL } = network;
    setValue('name', name || '');
    setValue('symbol', symbol);
    setValue('rpcURL', rpcURL);
    setValue('explorerURL', explorerURL);
  }, [network, setValue]);

  useEffect(() => {
    if (!url && !URITester.test(url)) {
      return;
    }
    setRpcUrlStatus((prev) => ({ ...prev, connected: false, loading: true }));
    serviceNetwork
      .preAddNetwork(url)
      .then(({ chainId, existingNetwork }) => {
        setValue('chainId', chainId);
        if (existingNetwork && mode !== 'edit') {
          setRpcUrlStatus({
            loading: false,
            connected: true,
            error: intl.formatMessage(
              { id: 'form__rpc_url_invalid_exist' },
              { name: existingNetwork.name },
            ),
          });
          return;
        }
        setRpcUrlStatus({ connected: true, loading: false });
      })
      .catch(() => {
        setRpcUrlStatus({
          loading: false,
          connected: false,
          error: intl.formatMessage({ id: 'form__rpc_fetched_failed' }),
        });
      })
      .finally(() => {
        trigger('rpcURL');
      });
  }, [url, intl, setValue, setError, serviceNetwork, trigger, mode]);

  const onSubmit = useCallback(
    async (data: NetworkValues) => {
      const params = {
        name: data.name,
        rpcURL: data.rpcURL,
        symbol: data.symbol,
        explorerURL: data.explorerURL,
        logoURI: route.params?.network?.logoURI,
      };
      if (network?.id) {
        await serviceNetwork.updateNetwork(network.id, params);
        ToastManager.show({
          title: intl.formatMessage({ id: 'msg__change_saved' }),
        });
      } else {
        await serviceNetwork.addNetwork('evm', params);
        ToastManager.show({
          title: intl.formatMessage({ id: 'msg__network_added' }),
        });
      }
      navigation.navigate(ManageNetworkModalRoutes.Listing);
    },
    [intl, serviceNetwork, navigation, route, network?.id],
  );

  const onShowRemoveModal = useCallback(() => {
    setRemoveOpened(true);
  }, []);

  const toQuickAddPage = useCallback(() => {
    navigation.navigate(ManageNetworkModalRoutes.QuickAdd);
  }, [navigation]);

  const onRemove = useCallback(async () => {
    await serviceNetwork.deleteNetwork(network?.id ?? '');
    setRemoveOpened(false);
    ToastManager.show({
      title: intl.formatMessage({ id: 'msg__network_removed' }),
    });
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    }
  }, [intl, serviceNetwork, network?.id, navigation]);

  const quickAddButton = useMemo(() => {
    if (mode === 'add' && network) {
      return null;
    }
    if (mode === 'edit' && network?.id) {
      return null;
    }
    return (
      <>
        <Pressable
          flex="1"
          alignItems="center"
          w="full"
          bg="surface-default"
          borderWidth="1"
          borderRadius="12px"
          borderColor="border-subdued"
          flexDirection="row"
          px="16px"
          py="8px"
          onPress={toQuickAddPage}
        >
          <Icon
            name={isSmallScreen ? 'LightningBoltOutline' : 'LightningBoltMini'}
            size={isSmallScreen ? 24 : 20}
          />
          <Text
            typography={isSmallScreen ? 'Body1Strong' : 'Body2Strong'}
            flex="1"
            ml="4"
          >
            {intl.formatMessage({ id: 'action__quick_add' })}
          </Text>
          <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
        </Pressable>
        <Divider my="6" />
      </>
    );
  }, [intl, isSmallScreen, mode, network, toQuickAddPage]);

  return (
    <>
      <Modal
        header={intl.formatMessage({ id: 'action__add_network' })}
        hidePrimaryAction
        height="560px"
        secondaryActionTranslationId="action__save"
        secondaryActionProps={{
          type: 'primary',
          isDisabled:
            !isValid || !!rpcUrlStatus.error || !rpcUrlStatus.connected,
          onPromise: handleSubmit(onSubmit),
        }}
        scrollViewProps={{
          children: (
            <KeyboardDismissView flexDirection="row" justifyContent="center">
              <VStack w="full">
                {quickAddButton}
                <Form>
                  <Form.Item
                    name="name"
                    label={intl.formatMessage({
                      id: 'form__network_name',
                      defaultMessage: 'Network Name',
                    })}
                    control={control}
                    rules={{
                      required: {
                        value: true,
                        message: intl.formatMessage({
                          id: 'form__field_is_required',
                        }),
                      },
                      validate: (value) => {
                        if (!value?.trim()) {
                          return intl.formatMessage({
                            id: 'form__field_is_required',
                          });
                        }
                      },
                      maxLength: {
                        value: 30,
                        message: intl.formatMessage({
                          id: 'form__network_name_invalid',
                        }),
                      },
                    }}
                  >
                    <Form.Input size={isSmallScreen ? 'xl' : 'default'} />
                  </Form.Item>
                  <Form.Item
                    name="rpcURL"
                    control={control}
                    label={intl.formatMessage({
                      id: 'form__rpc_url',
                      defaultMessage: 'RPC URL',
                    })}
                    helpText={hintText}
                    formControlProps={{ zIndex: 10 }}
                    rules={{
                      required: {
                        value: true,
                        message: intl.formatMessage({
                          id: 'form__field_is_required',
                        }),
                      },
                      pattern: {
                        value: RpcNodePattern,
                        message: intl.formatMessage({
                          id: 'form__rpc_url_wrong_format',
                        }),
                      },
                      maxLength: {
                        value: 100,
                        message: intl.formatMessage(
                          { id: 'form__validator_max_length' },
                          { value: 100 },
                        ),
                      },
                      validate: () => rpcUrlStatus.error,
                    }}
                  >
                    <Form.Input size={isSmallScreen ? 'xl' : 'default'} />
                  </Form.Item>
                  <Form.Item
                    name="chainId"
                    control={control}
                    label={intl.formatMessage({
                      id: 'form__chain_id',
                      defaultMessage: 'Chain ID',
                    })}
                  >
                    <Form.Input
                      isDisabled
                      size={isSmallScreen ? 'xl' : 'default'}
                    />
                  </Form.Item>
                  <Form.Item
                    name="symbol"
                    label={intl.formatMessage({
                      id: 'form__symbol',
                      defaultMessage: 'Symbol',
                    })}
                    labelAddon={
                      <Typography.Body2 color="text-subdued">
                        {intl.formatMessage({
                          id: 'form__hint_optional',
                          defaultMessage: 'Optional',
                        })}
                      </Typography.Body2>
                    }
                    control={control}
                    rules={{
                      maxLength: {
                        value: 15,
                        message: intl.formatMessage({
                          id: 'form__symbol_invalid',
                        }),
                      },
                    }}
                  >
                    <Form.Input
                      size={isSmallScreen ? 'xl' : 'default'}
                      placeholder="ETH"
                    />
                  </Form.Item>
                  <Form.Item
                    name="explorerURL"
                    label={intl.formatMessage({
                      id: 'form__blockchain_explorer_url',
                      defaultMessage: 'Blockchain Explore URL',
                    })}
                    labelAddon={
                      <Typography.Body2 color="text-subdued">
                        {intl.formatMessage({
                          id: 'form__hint_optional',
                          defaultMessage: 'Optional',
                        })}
                      </Typography.Body2>
                    }
                    control={control}
                    rules={{
                      pattern: {
                        value: /https?:\/\//,
                        message: intl.formatMessage({
                          id: 'form__blockchain_explorer_url_invalid',
                        }),
                      },
                      maxLength: {
                        value: 100,
                        message: intl.formatMessage(
                          { id: 'form__validator_max_length' },
                          { value: 100 },
                        ),
                      },
                    }}
                  >
                    <Form.Input size={isSmallScreen ? 'xl' : 'default'} />
                  </Form.Item>
                </Form>
                {mode === 'edit' &&
                network?.id &&
                network?.id !== activeNetwork?.id ? (
                  <IconButton
                    name="TrashMini"
                    mt={6}
                    type="outline"
                    onPress={onShowRemoveModal}
                  >
                    {intl.formatMessage({ id: 'action__remove' })}
                  </IconButton>
                ) : null}
              </VStack>
            </KeyboardDismissView>
          ),
        }}
      />

      <Dialog
        visible={removeOpend}
        onClose={() => setRemoveOpened(false)}
        contentProps={{
          iconType: 'danger',
          title: intl.formatMessage({
            id: 'dialog__remove_network_title',
            defaultMessage: 'Remove Network',
          }),
          content: intl.formatMessage(
            {
              id: 'dialog__remove_network_desc',
              defaultMessage: '“{0}” will be removed from your networks list.',
            },
            { 0: network?.name || '' },
          ),
        }}
        footerButtonProps={{
          primaryActionTranslationId: 'action__remove',
          primaryActionProps: {
            type: 'destructive',
            size: 'lg',
            onPromise: onRemove,
          },
          secondaryActionProps: {
            size: 'lg',
          },
        }}
      />
    </>
  );
};

export default AddNetwork;
