import React, { FC, ReactElement, useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Dialog,
  Form,
  Modal,
  useForm,
} from '@onekeyhq/components';

type NetworkValues = {
  name?: string;
  url?: string;
  chainId?: string;
  symbol?: string;
  exploreUrl?: string;
};

type NetworksProps = {
  trigger?: ReactElement<any>;
  defaultValues: NetworkValues;
  onSubmit?: (values: NetworkValues) => void;
};

export const NetworkDetail: FC<NetworksProps> = ({
  trigger,
  defaultValues,
  onSubmit,
}) => {
  const { control, handleSubmit, reset } = useForm<NetworkValues>({
    defaultValues,
  });
  const intl = useIntl();
  const [resetOpened, setResetOpened] = useState(false);
  const onReset = useCallback(() => {
    setResetOpened(true);
  }, []);
  const onPress = handleSubmit((data) => onSubmit?.(data));

  return (
    <>
      <Modal
        trigger={trigger}
        onPrimaryActionPress={({ onClose }) => {
          onPress();
          onClose?.();
        }}
      >
        <Box
          w="full"
          display="flex"
          flex="1"
          flexDirection="row"
          justifyContent="center"
        >
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
              formControlProps={{ zIndex: 10, maxW: '80' }}
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
                triggerProps={{
                  py: 2,
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
            <Button w="80" onPress={onReset} mt="2">
              {intl.formatMessage({
                id: 'action__reset',
                defaultMessage: 'Reset',
              })}
            </Button>
          </Form>
        </Box>
      </Modal>
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
          primaryActionTranslationId: 'action_reset',
          primaryActionProps: {
            type: 'primary',
            size: 'xl',
          },
          secondaryActionProps: {
            size: 'xl',
          },
        }}
        onClose={() => setResetOpened(false)}
      />
    </>
  );
};
