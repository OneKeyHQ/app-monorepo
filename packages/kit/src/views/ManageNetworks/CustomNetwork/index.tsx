import React, { FC, useCallback, useState } from 'react';

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

type NetworkCustomViewProps = NativeStackScreenProps<
  ManageNetworkRoutesParams,
  ManageNetworkRoutes.CustomNetwork
>;

export const CustomNetwork: FC<NetworkCustomViewProps> = ({ route }) => {
  const { name, rpcURL, symbol, exploreUrl, id } = route.params;
  const intl = useIntl();
  const navigation = useNavigation();
  const { info } = useToast();
  const { serviceNetwork } = backgroundApiProxy;
  const { control, handleSubmit } = useForm<NetworkValues>({
    defaultValues: { name, rpcURL, symbol, exploreUrl, id },
  });
  const [removeOpend, setRemoveOpened] = useState(false);

  const onShowRemoveModal = useCallback(() => {
    setRemoveOpened(true);
  }, []);

  const onRemove = useCallback(async () => {
    await serviceNetwork.deleteNetwork(id);
    setRemoveOpened(false);
    info(intl.formatMessage({ id: 'transaction__success' }));
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [serviceNetwork, id, info, intl, navigation]);

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
                  <Form.Input placeholder="chain id" />
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
