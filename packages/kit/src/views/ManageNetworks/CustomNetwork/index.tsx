import React, { FC, useCallback, useState } from 'react';

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

import { ManageNetworkRoutes, ManageNetworkRoutesParams } from '../types';

type NetworkValues = {
  name?: string;
  url?: string;
  chainId?: string;
  symbol?: string;
  exploreUrl?: string;
};

type NetworkCustomViewProps = NativeStackScreenProps<
  ManageNetworkRoutesParams,
  ManageNetworkRoutes.CustomNetwork
>;

export const CustomNetwork: FC<NetworkCustomViewProps> = ({ route }) => {
  const { defaultValues, isReadOnly } = route.params;
  const intl = useIntl();
  const { control, handleSubmit, reset } = useForm<NetworkValues>({
    defaultValues,
  });
  const [resetOpened, setResetOpened] = useState(false);
  const [removeOpend, setRemoveOpened] = useState(false);
  const onButtonPress = useCallback(() => {
    setResetOpened(true);
  }, []);
  const onShowRemoveModal = useCallback(() => {
    setRemoveOpened(true);
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
                  <Form.Input isDisabled={isReadOnly} />
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
                  <Form.Input placeholder="chain id" isDisabled={isReadOnly} />
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
                  <Form.Input placeholder="ETH" isDisabled={isReadOnly} />
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
                  <Form.Input isDisabled={isReadOnly} />
                </Form.Item>
                {isReadOnly ? (
                  <Button w="full" size="lg" onPress={onButtonPress}>
                    {intl.formatMessage({
                      id: 'action__reset',
                      defaultMessage: 'Reset',
                    })}
                  </Button>
                ) : (
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
                )}
              </Form>
            </KeyboardDismissView>
          ),
        }}
      />
      {isReadOnly ? (
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
      ) : (
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
                defaultMessage:
                  '“{0}” will be removed from your networks list.',
              },
              { 0: 'Ethereum Mainnet' },
            ),
          }}
          footerButtonProps={{
            onPrimaryActionPress: ({ onClose }) => {
              reset(defaultValues);
              onClose?.();
            },
            primaryActionTranslationId: 'action__remove',
            primaryActionProps: {
              type: 'destructive',
              size: 'lg',
            },
            secondaryActionProps: {
              size: 'lg',
            },
          }}
          onClose={() => setRemoveOpened(false)}
        />
      )}
    </>
  );
};
