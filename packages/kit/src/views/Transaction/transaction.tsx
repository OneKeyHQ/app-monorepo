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
  IconButton,
  Modal,
  Pressable,
  Select,
  Stack,
  Text,
  Typography,
  useForm,
  useIsVerticalLayout,
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
      label: asset.name,
      value: asset,
      description: `Balance:${asset.balance}`,
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
      <IconButton type="plain" size="xs" name="BookOpenSolid" />
      <IconButton type="plain" size="xs" name="ClipboardSolid" />
      <IconButton type="plain" size="xs" name="ScanSolid" />
    </Stack>
  );

  const isSmallScreen = useIsVerticalLayout();

  return (
    <Modal
      hidePrimaryAction
      hideSecondaryAction
      header={intl.formatMessage({ id: 'action__send' })}
      headerDescription="Ethereum"
      height="576px"
      footer={
        <Column>
          <Row
            justifyContent="space-between"
            alignItems="center"
            px={{ base: 4, md: 6 }}
            pt={4}
            pb={4 + bottom}
            borderTopWidth={1}
            borderTopColor="border-subdued"
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
              size={isSmallScreen ? 'lg' : 'base'}
              isDisabled={false}
              onPress={() => {
                onSubmit();
                navigation.navigate(
                  TransactionModalRoutes.TransactionConfirmModal,
                );
              }}
            >
              {intl.formatMessage({ id: 'action__continue' })}
            </Button>
          </Row>
        </Column>
      }
      scrollViewProps={{
        children: (
          <>
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
              <Box zIndex={999}>
                <Typography.Body2Strong mb="4px">
                  {intl.formatMessage({ id: 'content__asset' })}
                </Typography.Body2Strong>
                <Select
                  containerProps={{
                    w: 'full',
                  }}
                  headerShown={false}
                  defaultValue={AssetMockData[0]}
                  options={selectOptionData()}
                  footer={null}
                />
              </Box>
              <Form.Item
                formControlProps={{ width: 'full' }}
                label={intl.formatMessage({ id: 'content__amount' })}
                control={control}
                name="username"
                defaultValue=""
                rules={{
                  required: intl.formatMessage({ id: 'form__amount_invalid' }),
                }}
                helpText="0 USD"
              >
                <Form.Input
                  w="100%"
                  rightCustomElement={
                    <>
                      <Typography.Body2 mr={4} color="text-subdued">
                        ETH
                      </Typography.Body2>
                      <Divider
                        orientation="vertical"
                        bg="border-subdued"
                        h={5}
                      />
                      <Button type="plain">
                        {intl.formatMessage({ id: 'action__max' })}
                      </Button>
                    </>
                  }
                />
              </Form.Item>
              <Box>
                <Typography.Body2Strong mb="4px">
                  {intl.formatMessage({ id: 'content__fee' })}
                </Typography.Body2Strong>

                <Pressable
                  onPress={() => {
                    navigation.navigate(
                      TransactionModalRoutes.TransactionEditFeeModal,
                    );
                  }}
                >
                  {({ isHovered }) => (
                    <Row
                      justifyContent="space-between"
                      alignItems="center"
                      bgColor={
                        isHovered ? 'surface-hovered' : 'surface-default'
                      }
                      borderColor="border-default"
                      borderWidth="1px"
                      borderRadius="12px"
                      paddingX="12px"
                      paddingY="8px"
                    >
                      <Column>
                        <Text
                          typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                        >
                          Normal (64.11 Gwei)
                        </Text>
                        <Typography.Body2 color="text-subdued">
                          0.001694 ETH ~ 0.001977 ETH
                        </Typography.Body2>
                        <Typography.Body2 color="text-subdued">
                          3 min
                        </Typography.Body2>
                      </Column>
                      <Icon size={20} name="PencilSolid" />
                    </Row>
                  )}
                </Pressable>
              </Box>
            </Form>
            <Box display={{ md: 'none' }} h={10} />
          </>
        ),
      }}
    />
  );
};
export default Transaction;
