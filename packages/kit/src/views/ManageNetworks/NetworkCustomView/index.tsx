import React, { FC, useCallback, useState } from 'react';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Form,
  KeyboardDismissView,
  Modal,
  useForm,
} from '@onekeyhq/components';

import { ManageNetworkModalRoutes, ManageNetworkRoutesParams } from '../types';

type NetworkValues = {
  name?: string;
  url?: string;
  chainId?: string;
  symbol?: string;
  exploreUrl?: string;
};

type NetworkCustomViewProps = NativeStackScreenProps<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.NetworkCustomViewModal
>;

export const NetworkCustomView: FC<NetworkCustomViewProps> = ({ route }) => {
  const { defaultValues } = route.params;
  const intl = useIntl();
  const { control, handleSubmit, reset } = useForm<NetworkValues>({
    defaultValues,
  });
  const [resetOpened, setResetOpened] = useState(false);
  const onButtonPress = useCallback(() => {
    setResetOpened(true);
  }, []);
  const onSubmit = handleSubmit((data) => console.log(data));

  return (
    <>
      <Modal
        header="Ethereum"
        height="560px"
        onPrimaryActionPress={() => {
          onSubmit();
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
                >
                  <Form.Input />
                </Form.Item>
                <Form.Item
                  name="url"
                  control={control}
                  label={intl.formatMessage({
                    id: 'form__rpc_url',
                    defaultMessage: 'RPC URL',
                  })}
                  defaultValue="https://rpc.onekey.so/eth"
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
                    options={[
                      {
                        label: 'https://google.com',
                        value: 'https://google.com',
                      },
                      {
                        label: 'https://rpc.onekey.so/eth',
                        value: 'https://rpc.onekey.so/eth',
                      },
                      {
                        label: 'https://baidu.com',
                        value: 'https://baidu.com',
                      },
                    ]}
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
                  <Form.Input placeholder="chain id" />
                </Form.Item>
                <Form.Item
                  name="symbol"
                  label={intl.formatMessage({
                    id: 'form__symbol',
                    defaultMessage: 'Symbol',
                  })}
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
                  control={control}
                >
                  <Form.Input />
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
              defaultMessage:
                'Ethereum Mainnet will be revert to the default config',
            },
            { 0: 'Ethereum Mainnet' },
          ),
        }}
        footerButtonProps={{
          onPrimaryActionPress: ({ onClose }) => {
            reset(defaultValues);
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
