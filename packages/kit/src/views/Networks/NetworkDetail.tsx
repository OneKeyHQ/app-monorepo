import React, { FC, ReactElement, useCallback, useState } from 'react';

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
            <Form.Item name="name" label="Network Name" control={control}>
              <Form.Input placeholder="network name" />
            </Form.Item>
            <Form.Item
              name="url"
              control={control}
              label="rpcUrl"
              defaultValue="https://rpc.onekey.so/eth"
              formControlProps={{ zIndex: 10, maxW: '80' }}
            >
              <Form.Select
                title="Preset PRC URLs"
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
            <Form.Item name="chainId" label="ChainID" control={control}>
              <Form.Input placeholder="chain id" />
            </Form.Item>
            <Form.Item name="symbol" label="Symbol" control={control}>
              <Form.Input placeholder="ETH" />
            </Form.Item>
            <Form.Item
              name="exploreUrl"
              label="Blockchain Explore URL"
              control={control}
            >
              <Form.Input placeholder="Blockchain Explore URL" />
            </Form.Item>
            <Button w="80" onPress={onReset} mt="2">
              Reset
            </Button>
          </Form>
        </Box>
      </Modal>
      <Dialog
        visible={resetOpened}
        contentProps={{
          iconType: 'info',
          title: 'Reset Network',
          content: 'Ethereum Mainnet will be revert to the default config',
        }}
        footerButtonProps={{
          onPrimaryActionPress: ({ onClose }) => {
            reset(defaultValues);
            onClose?.();
          },
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
