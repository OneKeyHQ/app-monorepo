/* eslint-disable no-nested-ternary */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
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
  useToast,
} from '@onekeyhq/components';
import type { SelectItem } from '@onekeyhq/components/src/Select';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useGas } from '@onekeyhq/kit/src/hooks';
import { useManageTokens } from '@onekeyhq/kit/src/hooks/useManageTokens';

import { FormatBalance } from '../../components/Format';
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
  const { control, handleSubmit, watch } = useForm<TransactionValues>({
    mode: 'onSubmit',
  });

  const toast = useToast();

  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const { account } = useActiveWalletAccount();
  const { activeNetwork } = useGeneral();
  const { nativeToken, accountTokens } = useManageTokens();
  const { data: gasList } = useGas();
  const [selectOption, setSelectOption] = useState<Option>({} as Option);
  const [inputValue, setInputValue] = useState<string>();
  const isSmallScreen = useIsVerticalLayout();

  const options = useMemo(
    () =>
      accountTokens.map((token) => {
        const decimal = token.tokenIdOnNetwork
          ? activeNetwork?.network.tokenDisplayDecimals
          : activeNetwork?.network.nativeDisplayDecimals;
        return {
          label: token?.symbol ?? '-',
          value: token?.id,
          description: (
            <>
              {`${intl.formatMessage({ id: 'content__balance' })}`}
              &nbsp;&nbsp;
              <FormatBalance
                balance={token?.balance}
                formatOptions={{
                  fixed: decimal ?? 4,
                }}
              />
            </>
          ),
          tokenProps: {
            src: token?.logoURI,
          },
        };
      }),
    [
      accountTokens,
      intl,
      activeNetwork?.network.nativeDisplayDecimals,
      activeNetwork?.network.tokenDisplayDecimals,
    ],
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

  const gasPrice = gasList?.[1] ?? gasList?.[0] ?? '';
  const gasPriceFee = gasPrice
    ? typeof gasPrice === 'string'
      ? gasPrice
      : gasPrice.maxFeePerGas
    : null;

  useEffect(() => {
    const subscription = watch((value, { name, type }) => {
      if (type === 'change' && name === 'token') {
        const option = options.find((o) => o.value === value.token);
        if (option) setSelectOption(option);
      }
      if (type === 'change' && name === 'value') {
        setInputValue(value.value);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, options]);

  const onSubmit = handleSubmit(async (data) => {
    const tokenConfig =
      accountTokens.find((token) => token.id === data.token) ?? nativeToken;

    if (!account || !tokenConfig || !gasPriceFee) return;

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
      gasPrice: gasPriceFee ?? '5',
      gasLimit: '21000',
    };

    try {
      const gasLimit = await getGasLimit(params);

      params.gasLimit = gasLimit;
      navigation.navigate(SendRoutes.SendConfirm, params);
    } catch (e) {
      const error = e as { key?: string; message?: string };
      toast.show({
        title: error?.key || error?.message || '',
      });
    }
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
              <Typography.Body1Strong>
                {inputValue ?? '-'}&nbsp;&nbsp;
                {selectOption.label}
              </Typography.Body1Strong>
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
                  dropdownPosition="right"
                  onChange={(item) => {
                    console.log(item);
                  }}
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
                  validate: (value) => {
                    const token = accountTokens.find(
                      (accountToken) => accountToken.id === selectOption.value,
                    );
                    if (!token) return undefined;
                    const inputBN = new BigNumber(value);
                    const balanceBN = new BigNumber(token?.balance ?? '');
                    if (inputBN.isNaN() || balanceBN.isNaN()) {
                      return intl.formatMessage({ id: 'form__amount_invalid' });
                    }
                    if (balanceBN.isLessThan(inputBN)) {
                      return intl.formatMessage({ id: 'form__amount_invalid' });
                    }
                    return undefined;
                  },
                }}
                // helpText="0 USD"
              >
                <Form.Input
                  w="100%"
                  keyboardType="numeric"
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
                        <FormatBalance
                          formatOptions={{
                            fixed: 4,
                          }}
                          balance={gasPriceFee ?? ''}
                          suffix="Gwei"
                          render={(ele) => (
                            <Text
                              typography={{
                                sm: 'Body1Strong',
                                md: 'Body2Strong',
                              }}
                            >
                              {ele}
                            </Text>
                          )}
                        />

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
