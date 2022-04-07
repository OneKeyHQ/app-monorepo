/* eslint-disable no-nested-ternary */
import React, { useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { debounce } from 'lodash';
import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';
import { useDeepCompareMemo } from 'use-deep-compare';

import {
  Box,
  Button,
  Form,
  Modal,
  Typography,
  useForm,
  useFormState,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { SelectItem } from '@onekeyhq/components/src/Select';
import { ITransferInfo } from '@onekeyhq/engine/src/types/vault';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useManageTokens } from '@onekeyhq/kit/src/hooks/useManageTokens';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { FormatBalance } from '../../components/Format';
import { useActiveWalletAccount, useGeneral } from '../../hooks/redux';

import { FeeInfoInputForTransfer } from './FeeInfoInput';
import { SendRoutes, SendRoutesParams } from './types';
import { useFeeInfoPayload } from './useFeeInfoPayload';

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

// TODO utils function createPromisedDebounce
const buildEncodedTxFromTransferDebounced = debounce(
  (options: {
    networkId: string;
    accountId: string;
    transferInfo: ITransferInfo;
    callback: (promise: Promise<any>) => void;
  }) => {
    const { callback, ...others } = options;
    callback(backgroundApiProxy.engine.buildEncodedTxFromTransfer(others));
  },
  300,
  { leading: false, trailing: true },
);

const Transaction = () => {
  // const encodedTxRef = useRef<any>(null);
  const [encodedTx, setEncodedTx] = useState(null);
  const navigation = useNavigation<NavigationProps>();
  const { control, handleSubmit, watch } = useForm<TransactionValues>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: {
      to: '',
      value: '', // TODO rename to amount
    },
  });
  const { isValid } = useFormState({ control });
  const { account, accountId, networkId } = useActiveWalletAccount();
  const { feeInfoPayload, feeInfoLoading } = useFeeInfoPayload({
    encodedTx,
  });

  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const { activeNetwork } = useGeneral();
  const { nativeToken, accountTokens } = useManageTokens();
  // selected token
  const [selectOption, setSelectOption] = useState<Option | null>(null);
  const [inputValue, setInputValue] = useState<string>();
  const isSmallScreen = useIsVerticalLayout();

  const tokenOptions = useMemo(
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

  const selectedToken = useMemo(
    () =>
      accountTokens.find(
        (accountToken) => accountToken.id === selectOption?.value,
      ),
    [accountTokens, selectOption?.value],
  );

  const formFields = watch();

  // build transferInfo
  // TODO move to watch useEffect below
  const transferInfo: ITransferInfo = useDeepCompareMemo(() => {
    // TODO token undefined
    const { to, value } = formFields;
    const from = (account as { address: string }).address;
    const info = {
      from,
      to,
      // TODO use tokenId instead, and get tokenIdOnNetwork from buildEncodedTxFromTransfer
      token: selectedToken?.tokenIdOnNetwork,
      amount: value,
    };
    return info;
  }, [account, formFields, selectedToken]);

  // build encodedTx
  useEffect(() => {
    buildEncodedTxFromTransferDebounced({
      networkId,
      accountId,
      transferInfo,
      callback: async (promise) => {
        try {
          // TODO show loading
          const tx = await promise;
          if (tx) {
            setEncodedTx(tx);
          }
        } catch (e) {
          // TODO display static form error message
          console.error(e);
        }
      },
    });
  }, [accountId, networkId, transferInfo]);

  // form data changed watch handler
  useEffect(() => {
    const subscription = watch((formValues, { name, type }) => {
      if (type === 'change' && name === 'token') {
        const option = tokenOptions.find((o) => o.value === formValues.token);
        if (option) setSelectOption(option);
      }
      if (type === 'change' && name === 'value') {
        setInputValue(formValues.value);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, tokenOptions]);

  const submitButtonDisabled =
    !isValid ||
    feeInfoLoading ||
    !feeInfoPayload ||
    !formFields.to ||
    !formFields.value ||
    !encodedTx;
  const onSubmit = handleSubmit(async (data) => {
    const tokenConfig = selectedToken ?? nativeToken;

    if (!account || !tokenConfig || submitButtonDisabled) return;
    const encodedTxWithFee =
      await backgroundApiProxy.engine.attachFeeInfoToEncodedTx({
        networkId,
        accountId,
        encodedTx,
        feeInfoValue: feeInfoPayload?.current.value,
      });
    const params = {
      payloadType: 'transfer', // transfer, transferNft, swap
      payload: {
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
      },
      encodedTx: encodedTxWithFee,
      feeInfoSelected: feeInfoPayload?.selected,
    };

    navigation.navigate(SendRoutes.SendConfirm, params);
  });

  // select first token
  // TODO trigger watch allFields
  useEffect(() => {
    if (Array.isArray(tokenOptions) && tokenOptions?.length && !selectOption)
      setSelectOption(tokenOptions[0]);
  }, [selectOption, tokenOptions]);

  return (
    <Modal
      height="598px"
      hidePrimaryAction
      hideSecondaryAction
      header={intl.formatMessage({ id: 'action__send' })}
      headerDescription={activeNetwork?.network.name ?? ''}
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
            <Column flex={1} overflow="hidden">
              <Typography.Body2 color="text-subdued">
                {intl.formatMessage({ id: 'content__amount' })}
              </Typography.Body2>
              <Typography.Body1Strong>
                {inputValue || '-'}&nbsp;&nbsp;
                {selectOption?.label}
              </Typography.Body1Strong>
              {/* <Typography.Caption color="text-subdued">
                3 min
              </Typography.Caption> */}
            </Column>
            <Button
              type="primary"
              size={isSmallScreen ? 'xl' : 'base'}
              isDisabled={submitButtonDisabled}
              onPromise={onSubmit}
              // isLoading={feeInfoPayloadLoading}
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
                label={intl.formatMessage({ id: 'content__to' })}
                labelAddon={platformEnv.isExtension ? [] : ['paste']}
                control={control}
                name="to"
                formControlProps={{ width: 'full' }}
                rules={{
                  required: intl.formatMessage({ id: 'form__address_invalid' }),
                  validate: async (toAddress) => {
                    if (networkId.length > 0) {
                      return backgroundApiProxy.validator
                        .validateAddress(networkId, toAddress)
                        .then(
                          () => true,
                          () =>
                            intl.formatMessage({ id: 'form__address_invalid' }),
                        );
                    }
                  },
                }}
                defaultValue=""
              >
                <Form.Textarea
                  // TODO different max length in network
                  maxLength={80}
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
                  options={tokenOptions}
                  defaultValue={nativeToken?.id}
                  footer={null}
                  dropdownPosition="right"
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
                    const token = selectedToken;
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
                  maxLength={40}
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

                <FeeInfoInputForTransfer
                  encodedTx={encodedTx}
                  feeInfoPayload={feeInfoPayload}
                  loading={feeInfoLoading}
                />
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
