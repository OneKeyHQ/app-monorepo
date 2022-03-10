import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Form,
  Icon,
  Modal,
  Pressable,
  Text,
  Typography,
  useForm,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { SelectItem } from '@onekeyhq/components/src/Select';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useManageTokens } from '@onekeyhq/kit/src/hooks/useManageTokens';

import { useActiveWalletAccount, useGeneral } from '../../hooks/redux';

import { SendParams, SendRoutes, SendRoutesParams } from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendRoutes.Send
>;

type TransactionValues = {
  value: string;
  to: string;
  gasPrice: string;
  token: string;
};

type Option = SelectItem<string>;

const Transaction = () => {
  const navigation = useNavigation<NavigationProps>();
  const { control, handleSubmit } = useForm<TransactionValues>();

  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const { account } = useActiveWalletAccount();
  const { activeNetwork } = useGeneral();
  const { nativeToken, accountTokens } = useManageTokens();
  const [selectOption, setSelectOption] = useState<Option>({} as Option);

  const isSmallScreen = useIsVerticalLayout();

  const options = useMemo(
    () =>
      accountTokens.map((token) => ({
        label: token?.symbol ?? '-',
        value: token?.id,
        description: `${intl.formatMessage({ id: 'content__balance' })} ${
          token?.balance ?? ''
        }`,
        tokenProps: {
          src: token?.logoURI,
        },
      })),
    [accountTokens, intl],
  );

  const getGasLimit = useCallback(async (sendParams: SendParams) => {
    const gasLimit = await backgroundApiProxy.engine.prepareTransfer(
      sendParams.network.id,
      sendParams.account.id,
      sendParams.to,
      sendParams.value,
      sendParams.token.idOnNetwork,
    );
    return gasLimit;
  }, []);

  const onSubmit = handleSubmit(async (data) => {
    const tokenConfig =
      accountTokens.find((token) => token.id === data.token) ?? nativeToken;
    console.log(account, tokenConfig);
    if (!account || !tokenConfig) return;

    const params = {
      to: data.to,
      account: {
        id: account.id,
        name: account.name,
        address: (account as { address: string }).address,
      },
      network: {
        id: activeNetwork?.network.id ?? '',
        name: activeNetwork?.network.name ?? '',
      },
      value: data.value,
      token: {
        idOnNetwork: tokenConfig.tokenIdOnNetwork,
        logoURI: tokenConfig.logoURI,
        name: tokenConfig.name,
        symbol: tokenConfig.symbol,
      },
      gasPrice: '5',
      gasLimit: '21000',
    };

    try {
      const gasLimit = await getGasLimit(params);

      params.gasLimit = gasLimit;
    } catch (e) {
      console.log(e);
    }

    navigation.navigate(SendRoutes.SendConfirm, params);
  });

  useEffect(() => {
    if (Array.isArray(options) && options?.length) setSelectOption(options[0]);
  }, [options]);

  return (
    <Modal
      hidePrimaryAction
      hideSecondaryAction
      header={intl.formatMessage({ id: 'action__send' })}
      headerDescription={activeNetwork?.network.name ?? ''}
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
              {/* <Typography.Caption color="text-subdued">
                3 min
              </Typography.Caption> */}
            </Column>
            <Button
              type="primary"
              size={isSmallScreen ? 'xl' : 'base'}
              isDisabled={false}
              onPromise={onSubmit}
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
                labelAddon={['paste']}
                control={control}
                name="to"
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
              {/* <Box zIndex={999}>
                <Typography.Body2Strong mb="4px">
                  {intl.formatMessage({ id: 'content__asset' })}
                </Typography.Body2Strong>
                <Select
                  containerProps={{
                    w: 'full',
                  }}
                  headerShown={false}
                  onChange={(_, item) => setSelectOption(item)}
                  value={selectOption?.value}
                  options={options}
                  footer={null}
                />
              </Box> */}
              <Form.Item
                control={control}
                name="token"
                label={intl.formatMessage({ id: 'content__asset' })}
                formControlProps={{ zIndex: 10 }}
              >
                <Form.Select
                  containerProps={{
                    w: 'full',
                  }}
                  headerShown={false}
                  options={options}
                  defaultValue={nativeToken?.id}
                  footer={null}
                />
              </Form.Item>
              <Form.Item
                formControlProps={{ width: 'full' }}
                label={intl.formatMessage({ id: 'content__amount' })}
                control={control}
                name="value"
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
                        {selectOption?.label ?? '-'}
                      </Typography.Body2>
                      {/* <Divider
                        orientation="vertical"
                        bg="border-subdued"
                        h={5}
                      />
                      <Button type="plain">
                        {intl.formatMessage({ id: 'action__max' })}
                      </Button> */}
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
                    navigation.navigate(SendRoutes.SendEditFee);
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
                        {/* <Typography.Body2 color="text-subdued">
                          0.001694 ETH ~ 0.001977 ETH
                        </Typography.Body2> */}
                        {/* <Typography.Body2 color="text-subdued">
                          3 min
                        </Typography.Body2> */}
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
