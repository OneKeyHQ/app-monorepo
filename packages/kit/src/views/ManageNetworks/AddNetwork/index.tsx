import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Form,
  KeyboardDismissView,
  Modal,
  Typography,
  useForm,
} from '@onekeyhq/components';

type NetworkValues = {
  name?: string;
  url?: string;
  chainId?: string;
  symbol?: string;
  exploreUrl?: string;
};

export type NetworkAddViewProps = undefined;

export const AddNetwork: FC<NetworkAddViewProps> = () => {
  const intl = useIntl();
  const defaultValues = {
    name: '',
    url: '',
    chainId: '',
    symbol: '',
    exploreUrl: '',
  };
  const { control, handleSubmit } = useForm<NetworkValues>({
    defaultValues,
  });

  const onSubmit = handleSubmit((data) => console.log(data));

  return (
    <>
      <Modal
        header="Add Network"
        hidePrimaryAction
        secondaryActionTranslationId="action__save"
        secondaryActionProps={{ type: 'primary' }}
        onSecondaryActionPress={() => {
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
                  rules={{
                    required: {
                      value: true,
                      message: 'network name can not be empty',
                    },
                  }}
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
              </Form>
            </KeyboardDismissView>
          ),
        }}
      />
    </>
  );
};

export default AddNetwork;
