import React from 'react';

import { useNavigation } from '@react-navigation/core';
import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Divider,
  Form,
  Icon,
  Modal,
  Pressable,
  Select,
  Stack,
  Typography,
  useForm,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import {
  TransactionModalRoutes,
  TransactionModalRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/Transaction';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  TransactionModalRoutesParams,
  TransactionModalRoutes.TransactionConfirmModal
> &
  NativeStackNavigationProp<
    TransactionModalRoutesParams,
    TransactionModalRoutes.TransactionEditFeeModal
  >;

type TransactionValues = {
  username: string;
  email: string;
  description: string;
  agreement: boolean;
  isDev: boolean;
  options: string;
};

type AssetType = {
  token: string;
  name: string;
  balance: string;
};
const AssetMockData: AssetType[] = [
  {
    token: 'eth',
    name: 'ETH',
    balance: '2.11014',
  },
  {
    token: 'usdt',
    name: 'USDT',
    balance: '2.11014',
  },
  {
    token: 'btc',
    name: 'BTC',
    balance: '2.11014',
  },
];

function selectOptionData() {
  const options = [];
  for (let index = 0; index < AssetMockData.length; index += 1) {
    const asset = AssetMockData[index];
    options.push({
      label: asset.token,
      value: asset,
      description: asset.balance,
      tokenProps: {
        chain: asset.token,
      },
    });
  }

  return options;
}

const Transaction = () => {
  const navigation = useNavigation<NavigationProps>();
  const { control, handleSubmit } = useForm<TransactionValues>();
  const onSubmit = handleSubmit((data) => console.log(data));
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();

  const labelAddon = (
    <Stack direction="row" space="2">
      <Pressable onPress={() => {}}>
        <Icon size={20} name="BookOpenSolid" />
      </Pressable>
      <Pressable>
        <Icon size={20} name="ClipboardSolid" />
      </Pressable>
      <Pressable>
        <Icon size={20} name="ScanSolid" />
      </Pressable>
    </Stack>
  );

  return (
    <Modal
      hidePrimaryAction
      hideSecondaryAction
      header={intl.formatMessage({ id: 'action__send' })}
      headerDescription="Ethereum"
      footer={
        <Column>
          <Divider />
          <Row
            justifyContent="space-between"
            alignItems="center"
            paddingX="24px"
            paddingTop="16px"
            paddingBottom={bottom}
          >
            <Column>
              <Typography.Body2 color="text-subdued">
                {intl.formatMessage({ id: 'content__total' })}
              </Typography.Body2>
              <Typography.Body1Strong>0 ETH</Typography.Body1Strong>
              <Typography.Caption color="text-subdued">
                3 min
              </Typography.Caption>
            </Column>
            <Button
              type="primary"
              size="lg"
              isDisabled={false}
              onPress={() => {
                onSubmit();
                navigation.navigate(
                  TransactionModalRoutes.TransactionConfirmModal,
                );
              }}
            >
              <Typography.Body1Strong>
                {intl.formatMessage({ id: 'action__continue' })}
              </Typography.Body1Strong>
            </Button>
          </Row>
        </Column>
      }
      scrollViewProps={{
        children: (
          <Column flex="1">
            <Form>
              <Form.Item
                label={intl.formatMessage({ id: 'action__send' })}
                labelAddon={labelAddon}
                control={control}
                name="description"
                formControlProps={{ width: 'full' }}
                rules={{
                  required: intl.formatMessage({ id: 'form__address_invalid' }),
                }}
                defaultValue=""
              >
                <Form.Textarea
                  placeholder={intl.formatMessage({ id: 'form__address' })}
                  borderRadius="12px"
                />
              </Form.Item>
              <Typography.Body2Strong mt="24px" mb="4px">
                {intl.formatMessage({ id: 'content__asset' })}
              </Typography.Body2Strong>
              <Select
                containerProps={{
                  w: 'full',
                  zIndex: 999,
                  mb: '24px',
                  borderColor: 'border-default',
                  borderWidth: '1px',
                  borderRadius: '12px',
                }}
                headerShown={false}
                defaultValue={AssetMockData[0]}
                options={selectOptionData()}
              />
              <Form.Item
                formControlProps={{ width: 'full' }}
                label={intl.formatMessage({ id: 'content__amount' })}
                control={control}
                name="username"
                defaultValue=""
                rules={{
                  required: intl.formatMessage({ id: 'form__amount_invalid' }),
                }}
              >
                <Form.Input
                  w="100%"
                  rightSecondaryText={intl.formatMessage({ id: 'action__max' })}
                  rightText="ETH"
                />
              </Form.Item>
              <Typography.Body2 mt="8px" color="text-subdued">
                0 USD
              </Typography.Body2>
              <Typography.Body2Strong mt="24px" mb="4px">
                {intl.formatMessage({ id: 'content__fee' })}
              </Typography.Body2Strong>

              <Pressable
                onPress={() => {
                  navigation.navigate(
                    TransactionModalRoutes.TransactionEditFeeModal,
                  );
                }}
              >
                <Row
                  justifyContent="space-between"
                  alignItems="center"
                  bgColor="surface-default"
                  borderColor="border-default"
                  borderWidth="1px"
                  borderRadius="12px"
                  paddingX="12px"
                  paddingY="8px"
                >
                  <Column>
                    <Typography.Body1Strong>
                      Normal (64.11 Gwei)
                    </Typography.Body1Strong>
                    <Typography.Body2 color="text-subdued">
                      0.001694 ETH ~ 0.001977 ETH
                    </Typography.Body2>
                    <Typography.Body2 color="text-subdued">
                      3 min
                    </Typography.Body2>
                  </Column>
                  <Icon size={20} name="PencilSolid" />
                </Row>
              </Pressable>

              <Box height="50px" />
            </Form>
          </Column>
        ),
      }}
    />
  );
};
export default Transaction;
