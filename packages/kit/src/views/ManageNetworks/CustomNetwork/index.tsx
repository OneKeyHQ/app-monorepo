import React, { FC, useCallback, useEffect, useState } from 'react';

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
import { ManageNetworkRoutes, ManageNetworkRoutesParams } from '../types';

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

const URITester =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;

export const CustomNetwork: FC<NetworkCustomViewProps> = ({ route }) => {
  const { name, rpcURL, symbol, exploreUrl, id, chainId } = route.params;
  const intl = useIntl();
  const navigation = useNavigation();
  const { text } = useToast();
  const [hintText, setHintText] = useState('');
  const { serviceNetwork } = backgroundApiProxy;
  const { control, handleSubmit, watch, setError, setValue } =
    useForm<NetworkValues>({
      defaultValues: { name, rpcURL, symbol, exploreUrl, id, chainId },
    });
  const [removeOpend, setRemoveOpened] = useState(false);

  const onShowRemoveModal = useCallback(() => {
    setRemoveOpened(true);
  }, []);

  const onRemove = useCallback(async () => {
    await serviceNetwork.deleteNetwork(id);
    setRemoveOpened(false);
    text('msg__network_removed');
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [serviceNetwork, id, text, navigation]);

  const onSubmit = useCallback(
    async (data: NetworkValues) => {
      await serviceNetwork.updateNetwork(id, { rpcURL: data.rpcURL });
      text('msg__change_saved');
    },
    [serviceNetwork, id, text],
  );

  const watchedRpcURL = useDebounce(watch('rpcURL'), 1000);

  useEffect(() => {
    const url = watchedRpcURL?.trim();
    if (url && URITester.test(url)) {
      setHintText(intl.formatMessage({ id: 'form__rpc_url_connecting' }));
      serviceNetwork
        .preAddNetwork(url)
        .then(({ chainId: pChainId, existingNetwork }) => {
          if (pChainId !== chainId) {
            setHintText('');
            setError('rpcURL', { message: '' });
          }
          if (existingNetwork && url !== rpcURL) {
            setHintText('');
            setError('rpcURL', {
              message: intl.formatMessage(
                { id: 'form__rpc_url_invalid_exist' },
                { name: existingNetwork.name },
              ),
            });
            return;
          }
          return serviceNetwork
            .getRPCEndpointStatus(url, 'evm')
            .then(({ responseTime }) => {
              setHintText(
                intl.formatMessage(
                  { id: 'form__rpc_url_spped' },
                  { value: responseTime },
                ),
              );
            });
        })
        .catch(() => {
          setHintText(intl.formatMessage({ id: 'form__rpc_fetched_failed' }));
        });
    }
  }, [
    chainId,
    rpcURL,
    watchedRpcURL,
    intl,
    setValue,
    setError,
    serviceNetwork,
  ]);

  return (
    <>
      <Modal
        header={name}
        height="560px"
        primaryActionProps={{ onPromise: handleSubmit(onSubmit) }}
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
                >
                  <Form.Input />
                </Form.Item>
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
