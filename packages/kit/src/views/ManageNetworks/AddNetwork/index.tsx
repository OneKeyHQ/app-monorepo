import React, { FC, useCallback, useEffect, useState } from 'react';

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

const URITester =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;

export const AddNetwork: FC<NetworkAddViewProps> = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { text } = useToast();
  const [hintText, setHintText] = useState('');
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
    formState: { isValid },
  } = useForm<NetworkValues>({
    defaultValues,
    mode: 'onChange',
  });

  const watchedRpcURL = useDebounce(watch('rpcURL'), 1000);

  useEffect(() => {
    const url = watchedRpcURL?.trim();
    if (url && URITester.test(url)) {
      setHintText(intl.formatMessage({ id: 'form__rpc_url_connecting' }));
      serviceNetwork
        .preAddNetwork(url)
        .then(({ chainId, existingNetwork }) => {
          setValue('chainId', chainId);
          if (existingNetwork) {
            setHintText('');
            setError('rpcURL', {
              message: intl.formatMessage(
                { id: 'form__rpc_url_invalid_exist' },
                { name: existingNetwork.name },
              ),
            });
          } else {
            setHintText(intl.formatMessage({ id: 'form__rpc_url_fetched' }));
          }
        })
        .catch(() => {
          setHintText(intl.formatMessage({ id: 'form__rpc_fetched_failed' }));
        });
    }
  }, [watchedRpcURL, intl, setValue, setError, serviceNetwork]);

  const onSubmit = useCallback(
    async (data: NetworkValues) => {
      await serviceNetwork.addNetwork('evm', {
        name: data.name,
        rpcURL: data.rpcURL,
        symbol: data.symbol,
        explorerURL: data.explorerURL,
      });
      text('msg__network_added');
      navigation.goBack();
    },
    [text, serviceNetwork, navigation],
  );

  return (
    <>
      <Modal
        header={intl.formatMessage({ id: 'action__add_network' })}
        hidePrimaryAction
        secondaryActionTranslationId="action__save"
        secondaryActionProps={{
          type: 'primary',
          isDisabled: !isValid,
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
