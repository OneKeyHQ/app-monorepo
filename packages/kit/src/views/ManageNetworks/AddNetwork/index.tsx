import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Form,
  KeyboardDismissView,
  Modal,
  Typography,
  useForm,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useDebounce, useToast } from '../../../hooks';

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
  const navigation = useNavigation();
  const { info } = useToast();

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
        .then(({ chainId, existingNetwork }) => {
          setValue('chainId', chainId);
          if (existingNetwork) {
            setRpcUrlStatus({
              feeInfoLoading: false,
              connected: true,
              error: intl.formatMessage(
                { id: 'form__rpc_url_invalid_exist' },
                { name: existingNetwork.name },
              ),
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
  }, [url, intl, setValue, setError, serviceNetwork, trigger]);

  const onSubmit = useCallback(
    async (data: NetworkValues) => {
      await serviceNetwork.addNetwork('evm', {
        name: data.name,
        rpcURL: data.rpcURL,
        symbol: data.symbol,
        explorerURL: data.explorerURL,
      });
      info(intl.formatMessage({ id: 'msg__network_added' }));
      navigation.goBack();
    },
    [info, intl, serviceNetwork, navigation],
  );

  return (
    <>
      <Modal
        header={intl.formatMessage({ id: 'action__add_network' })}
        hidePrimaryAction
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
                  formControlProps={{ zIndex: 10 }}
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
                  control={control}
                  label={intl.formatMessage({
                    id: 'form__chain_id',
                    defaultMessage: 'Chain ID',
                  })}
                >
                  <Form.Input isDisabled />
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
                  <Form.Input />
                </Form.Item>
              </Form>
            </KeyboardDismissView>
          ),
        }}
      />
    </>
  );
};

export default AddNetwork;
