import React, { FC, useCallback, useEffect, useState } from 'react';

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
import { useToast } from '../../../hooks';
import { ManageNetworkRoutes, ManageNetworkRoutesParams } from '../types';

type NetworkValues = {
  name?: string;
  rpcURL?: string;
  chainId?: string;
  symbol?: string;
  exploreUrl?: string;
  id: string;
};

type PresetNetwokProps = NativeStackScreenProps<
  ManageNetworkRoutesParams,
  ManageNetworkRoutes.PresetNetwork
>;

export const PresetNetwork: FC<PresetNetwokProps> = ({ route }) => {
  const { name, rpcURL, chainId, symbol, exploreUrl, id } = route.params;
  const intl = useIntl();
  const { info } = useToast();
  const [rpcUrls, setRpcUrls] = useState<string[]>([]);
  const { serviceNetwork } = backgroundApiProxy;
  const { control, handleSubmit, reset } = useForm<NetworkValues>({
    defaultValues: { name, rpcURL, chainId, symbol, exploreUrl, id },
  });
  const [resetOpened, setResetOpened] = useState(false);

  const onButtonPress = useCallback(() => {
    setResetOpened(true);
  }, []);

  useEffect(() => {
    serviceNetwork.getPresetRpcEndpoints(id).then((urls: string[]) => {
      setRpcUrls(urls);
    });
  }, [serviceNetwork, id]);

  const onSubmit = useCallback(
    async (data: NetworkValues) => {
      await serviceNetwork.updateNetwork(id, { rpcURL: data.rpcURL });
      info(intl.formatMessage({ id: 'transaction__success' }));
    },
    [serviceNetwork, id, info, intl],
  );

  return (
    <>
      <Modal
        header={name}
        height="560px"
        primaryActionProps={{
          onPromise: handleSubmit(onSubmit),
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
                >
                  <Form.Input isDisabled />
                </Form.Item>
                <Form.Item
                  name="rpcURL"
                  control={control}
                  label={intl.formatMessage({
                    id: 'form__rpc_url',
                    defaultMessage: 'RPC URL',
                  })}
                  formControlProps={{ zIndex: 10 }}
                >
                  <Form.Select
                    title={intl.formatMessage({
                      id: 'content__preset_rpc',
                      defaultMessage: 'Preset PRC URLs',
                    })}
                    footer={null}
                    containerProps={{
                      zIndex: 999,
                      padding: 0,
                    }}
                    options={rpcUrls.map((url) => ({ label: url, value: url }))}
                  />
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
                    placeholder={intl.formatMessage({ id: 'form__chain_id' })}
                    isDisabled
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
                  <Form.Input placeholder="ETH" isDisabled />
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
                  <Form.Input isDisabled />
                </Form.Item>
                <Button w="full" size="lg" onPress={onButtonPress}>
                  {intl.formatMessage({
                    id: 'action__reset',
                    defaultMessage: 'Reset',
                  })}
                </Button>
              </Form>
            </KeyboardDismissView>
          ),
        }}
      />
      <Dialog
        visible={resetOpened}
        contentProps={{
          iconType: 'info',
          title: intl.formatMessage({
            id: 'dialog__reset_network_title',
            defaultMessage: 'Reset Network',
          }),
          content: intl.formatMessage(
            {
              id: 'dialog__reset_network_desc',
              defaultMessage: '{0} will be revert to the default config',
            },
            { 0: name },
          ),
        }}
        footerButtonProps={{
          onPrimaryActionPress: ({ onClose }) => {
            reset(route.params);
            onClose?.();
          },
          primaryActionTranslationId: 'action__reset',
          primaryActionProps: {
            type: 'primary',
            size: 'lg',
          },
          secondaryActionProps: {
            size: 'lg',
          },
        }}
        onClose={() => setResetOpened(false)}
      />
    </>
  );
};
