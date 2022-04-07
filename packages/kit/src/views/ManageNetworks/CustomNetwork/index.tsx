import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Form,
  KeyboardDismissView,
  Modal,
  Typography,
  useForm,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useDebounce, useToast } from '../../../hooks';
import { useActiveWalletAccount } from '../../../hooks/redux';
import { ManageNetworkRoutes, ManageNetworkRoutesParams } from '../types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NetworkValues = {
  name?: string;
  rpcURL?: string;
  chainId?: string;
  symbol?: string;
  exploreUrl?: string;
  id: string;
};

type NetworkCustomViewProps = NativeStackScreenProps<
  ManageNetworkRoutesParams,
  ManageNetworkRoutes.CustomNetwork
>;

type NavigationProps = NativeStackNavigationProp<
  ManageNetworkRoutesParams,
  ManageNetworkRoutes.CustomNetwork
>;

export type NetworkRpcURLStatus = {
  connected: boolean;
  loading?: boolean;
  speed?: number;
  error?: string;
};

const URITester =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;

export const CustomNetwork: FC<NetworkCustomViewProps> = ({ route }) => {
  const { name, rpcURL, symbol, exploreUrl, id, chainId } = route.params;
  const intl = useIntl();
  const { network } = useActiveWalletAccount();
  const navigation = useNavigation<NavigationProps>();
  const { info } = useToast();
  const [rpcUrlStatus, setRpcUrlStatus] = useState<NetworkRpcURLStatus>({
    connected: false,
  });
  const { serviceNetwork } = backgroundApiProxy;
  const {
    control,
    handleSubmit,
    watch,
    setError,
    setValue,
    trigger,
    formState: { isValid },
  } = useForm<NetworkValues>({
    defaultValues: { name, rpcURL, symbol, exploreUrl, id, chainId },
    mode: 'onChange',
  });
  const [removeOpend, setRemoveOpened] = useState(false);

  const onShowRemoveModal = useCallback(() => {
    setRemoveOpened(true);
  }, []);

  const onRemove = useCallback(async () => {
    await serviceNetwork.deleteNetwork(id);
    setRemoveOpened(false);
    info(intl.formatMessage({ id: 'msg__network_removed' }));
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [intl, info, serviceNetwork, id, navigation]);

  const onSubmit = useCallback(
    async (data: NetworkValues) => {
      await serviceNetwork.updateNetwork(id, {
        rpcURL: data.rpcURL,
        name: data.name,
        symbol: data.symbol,
        explorerURL: data.exploreUrl,
      });
      info(intl.formatMessage({ id: 'msg__change_saved' }));
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    },
    [serviceNetwork, id, info, intl, navigation],
  );

  const hintText = useMemo(() => {
    if (rpcUrlStatus.error) return '';
    if (rpcUrlStatus.feeInfoLoading) {
      return intl.formatMessage({ id: 'form__rpc_url_connecting' });
    }
    if (rpcUrlStatus.connected) {
      return intl.formatMessage({ id: 'form__rpc_url_fetched' });
    }
  }, [rpcUrlStatus, intl]);

  const watchedRpcURL = useDebounce(watch('rpcURL'), 1000);
  const url = watchedRpcURL?.trim();

  useEffect(() => {
    if (url && URITester.test(url)) {
      setRpcUrlStatus((prev) => ({ ...prev, connected: false, feeInfoLoading: true }));
      serviceNetwork
        .preAddNetwork(url)
        .then(({ chainId: pChainId }) => {
          if (pChainId !== chainId) {
            setRpcUrlStatus({
              feeInfoLoading: false,
              connected: true,
              error: intl.formatMessage({ id: 'form__chain_id_invalid' }),
            });
            return;
          }
          setRpcUrlStatus({ connected: true, feeInfoLoading: false });
        })
        .catch(() => {
          setRpcUrlStatus({
            feeInfoLoading: false,
            connected: false,
            error: intl.formatMessage({ id: 'form__rpc_fetched_failed' }),
          });
        })
        .finally(() => {
          trigger('rpcURL');
        });
    }
  }, [url, intl, setValue, setError, serviceNetwork, chainId, trigger]);

  return (
    <>
      <Modal
        header={name}
        height="560px"
        primaryActionProps={{
          onPromise: handleSubmit(onSubmit),
          isDisabled:
            (!isValid && !!rpcUrlStatus.error) || !rpcUrlStatus.connected,
        }}
        primaryActionTranslationId="action__save"
        hideSecondaryAction
        scrollViewProps={{
          children: (
            <KeyboardDismissView flexDirection="row" justifyContent="center">
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
                  <Form.Input />
                </Form.Item>
                <Form.Item
                  name="rpcURL"
                  control={control}
                  label={intl.formatMessage({
                    id: 'form__rpc_url',
                    defaultMessage: 'RPC URL',
                  })}
                  helpText={hintText}
                  rules={{
                    required: {
                      value: true,
                      message: intl.formatMessage({
                        id: 'form__field_is_required',
                      }),
                    },
                    pattern: {
                      value: /^https?:\/\//,
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
                  <Form.Input />
                </Form.Item>
                <Form.Item
                  name="chainId"
                  label={intl.formatMessage({
                    id: 'form__chain_id',
                    defaultMessage: 'Chain ID',
                  })}
                  control={control}
                >
                  <Form.Input
                    isDisabled
                    placeholder={intl.formatMessage({
                      id: 'form__chain_id',
                      defaultMessage: 'Chain ID',
                    })}
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
                  <Form.Input placeholder="ETH" />
                </Form.Item>
                <Form.Item
                  name="exploreUrl"
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
                  <Form.Input />
                </Form.Item>
                {network?.network.id !== id ? (
                  <Button
                    w="full"
                    size="lg"
                    type="outline"
                    onPress={onShowRemoveModal}
                  >
                    {intl.formatMessage({
                      id: 'action__remove',
                      defaultMessage: 'Remove',
                    })}
                  </Button>
                ) : null}
              </Form>
            </KeyboardDismissView>
          ),
        }}
      />
      <Dialog
        visible={removeOpend}
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
            { 0: name },
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
        onClose={() => setRemoveOpened(false)}
      />
    </>
  );
};
