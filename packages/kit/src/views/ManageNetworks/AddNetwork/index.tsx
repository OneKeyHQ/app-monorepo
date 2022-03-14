import React, { FC, useCallback } from 'react';

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
import { useToast } from '../../../hooks';

type NetworkValues = {
  name: string;
  rpcURL: string;
  chainId?: string;
  symbol?: string;
  explorerURL?: string;
};

export type NetworkAddViewProps = undefined;

export const AddNetwork: FC<NetworkAddViewProps> = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { text } = useToast();
  const { serviceNetwork } = backgroundApiProxy;
  const defaultValues = {
    name: '',
    rpcURL: '',
    chainId: '',
    symbol: '',
    explorerURL: '',
  };
  const { control, handleSubmit } = useForm<NetworkValues>({
    defaultValues,
  });

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
        header="Add Network"
        hidePrimaryAction
        secondaryActionTranslationId="action__save"
        secondaryActionProps={{
          type: 'primary',
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
                    required: {
                      value: true,
                      message: intl.formatMessage({
                        id: 'form__field_is_required',
                      }),
                    },
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
