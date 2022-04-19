/* eslint-disable no-nested-ternary, @typescript-eslint/no-unused-vars */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import deepEqual from 'dequal';
import { debounce } from 'lodash';
import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';
import { useDeepCompareMemo } from 'use-deep-compare';

import {
  Box,
  Button,
  Divider,
  Form,
  Modal,
  NumberInput,
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

import { FormatBalance, FormatCurrencyToken } from '../../components/Format';
import { useActiveWalletAccount, useGeneral } from '../../hooks/redux';

import { DecodeTxButtonTest } from './DecodeTxButtonTest';
import { FeeInfoInputForTransfer } from './FeeInfoInput';
import {
  SendRoutes,
  SendRoutesParams,
  TransferSendParamsPayload,
} from './types';
import { useFeeInfoPayload } from './useFeeInfoPayload';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendRoutes.Send
>;
type RouteProps = RouteProp<SendRoutesParams, SendRoutes.Send>;

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [buildLoading, setBuildLoading] = useState(false);
  const navigation = useNavigation<NavigationProps>();
  const [isMax, setIsMax] = useState(false);
  const route = useRoute<RouteProps>();
  const { token: routeParamsToken } = route.params;

  const { control, handleSubmit, watch, trigger, getValues, setValue } =
    useForm<TransactionValues>({
      mode: 'onBlur',
      reValidateMode: 'onBlur',
      defaultValues: {
        to: '',
        value: '', // TODO rename to amount
      },
    });
  const { isValid } = useFormState({ control });
  const {
    account,
    accountId,
    networkId,
    network: activeNetwork,
  } = useActiveWalletAccount();
  const { feeInfoPayload, feeInfoLoading } = useFeeInfoPayload({
    encodedTx,
  });
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();

  const { nativeToken, accountTokens, balances, getTokenBalance } =
    useManageTokens();
  // selected token
  const [selectOption, setSelectOption] = useState<Option | null>(null);
  const [inputValue, setInputValue] = useState<string>();
  const isSmallScreen = useIsVerticalLayout();

  const tokenOptions = useMemo(
    () =>
      accountTokens.map((token) => {
        const decimal = token.tokenIdOnNetwork
          ? activeNetwork?.tokenDisplayDecimals
          : activeNetwork?.nativeDisplayDecimals;
        return {
          label: token?.symbol ?? '-',
          value: token?.id,
          description: (
            <>
              {`${intl.formatMessage({ id: 'content__balance' })}`}
              &nbsp;&nbsp;
              <FormatBalance
                balance={getTokenBalance(token, '0')}
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
      activeNetwork?.tokenDisplayDecimals,
      activeNetwork?.nativeDisplayDecimals,
      intl,
      getTokenBalance,
    ],
  );

  const selectedToken = useMemo(
    () =>
      accountTokens.find(
        (accountToken) => accountToken.id === selectOption?.value,
      ),
    [accountTokens, selectOption?.value],
  );

  const [transferInfo, setTransferInfo] = useState<ITransferInfo>({
    from: '',
    to: '',
    amount: '',
  });

  // build encodedTx
  useEffect(() => {
    if (!transferInfo.to || !isValid) {
      return;
    }
    setBuildLoading(true);
    setEncodedTx(null);

    buildEncodedTxFromTransferDebounced({
      networkId,
      accountId,
      transferInfo,
      callback: async (promise) => {
        try {
          const tx = await promise;
          if (tx) {
            setEncodedTx(tx);
          }
        } catch (e) {
          // TODO display static form error message
          console.error(e);
        } finally {
          setBuildLoading(false);
        }
      },
    });
  }, [accountId, isValid, networkId, transferInfo]);

  const updateTransferInfo = useCallback(() => {
    const formValues = getValues();
    let { to, value } = formValues;
    const from = (account as { address: string }).address;
    // max token transfer
    if (selectedToken?.tokenIdOnNetwork && isMax) {
      value = getTokenBalance(selectedToken, '');
    }
    const info = {
      from,
      to,
      // TODO use tokenId instead, and get tokenIdOnNetwork from buildEncodedTxFromTransfer
      token: selectedToken?.tokenIdOnNetwork,
      amount: value,
      max: isMax,
    } as ITransferInfo;
    if (!deepEqual(transferInfo, info)) {
      setTransferInfo(info);
    }
  }, [account, getTokenBalance, getValues, isMax, selectedToken, transferInfo]);

  useEffect(() => {
    updateTransferInfo();
  }, [isMax, updateTransferInfo]);

  // form data changed watch handler
  useEffect(() => {
    const subscription = watch((formValues, { name, type }) => {
      updateTransferInfo();
      if (type === 'change' && name === 'token') {
        const option = tokenOptions.find((o) => o.value === formValues.token);
        if (option) {
          setSelectOption(option);
          // setValue('value', '');
          setTimeout(() => {
            trigger('value');
          }, 300);
        }
      }
      if (type === 'change' && name === 'value') {
        setInputValue(formValues.value);
        setTimeout(() => {
          trigger('value');
        }, 300);
      }
    });
    return () => subscription.unsubscribe();
  }, [watch, tokenOptions, trigger, updateTransferInfo, setValue]);

  const submitButtonDisabled =
    !isValid ||
    feeInfoLoading ||
    !feeInfoPayload ||
    !getValues('to') ||
    (!getValues('value') && !isMax) ||
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
    const payload: TransferSendParamsPayload = {
      to: data.to,
      account: {
        id: account.id,
        name: account.name,
        address: (account as { address: string }).address,
      },
      network: {
        id: activeNetwork?.id ?? '',
        name: activeNetwork?.name ?? '',
      },
      value: data.value,
      isMax,
      token: {
        idOnNetwork: tokenConfig.tokenIdOnNetwork,
        logoURI: tokenConfig.logoURI,
        name: tokenConfig.name,
        symbol: tokenConfig.symbol,
        balance: getTokenBalance(tokenConfig, '0'),
      },
    };
    const params = {
      payloadType: 'transfer', // transfer, transferNft, swap
      payload,
      backRouteName: SendRoutes.Send,
      encodedTx: encodedTxWithFee,
      feeInfoSelected: feeInfoPayload?.selected,
    };

    navigation.navigate(SendRoutes.SendConfirm, params);
  });

  // select first token
  // TODO trigger watch allFields
  useEffect(() => {
    if (Array.isArray(tokenOptions) && tokenOptions?.length && !selectOption) {
      if (routeParamsToken) {
        const option = tokenOptions.find(
          (o) => o.value === routeParamsToken?.id,
        );
        if (option) {
          setSelectOption(option);
          return;
        }
      }
      setSelectOption(tokenOptions[0]);
    }
  }, [routeParamsToken, selectOption, tokenOptions]);

  return (
    <Modal
      height="598px"
      hideSecondaryAction
      primaryActionTranslationId="action__continue"
      primaryActionProps={{
        isDisabled: submitButtonDisabled,
        onPress: onSubmit,
      }}
      header={intl.formatMessage({ id: 'action__send' })}
      headerDescription={activeNetwork?.name ?? ''}
      scrollViewProps={{
        children: (
          <>
            <Form>
              <Form.Item
                label={intl.formatMessage({ id: 'content__to' })}
                labelAddon={platformEnv.isExtension ? [] : ['paste']}
                onLabelAddonPress={() => trigger('to')} // call validation after paste
                control={control}
                name="to"
                formControlProps={{ width: 'full' }}
                rules={{
                  required: intl.formatMessage({ id: 'form__address_invalid' }),
                  validate: async (toAddress) => {
                    try {
                      await backgroundApiProxy.validator.validateAddress(
                        networkId,
                        toAddress,
                      );
                    } catch (error) {
                      return intl.formatMessage({
                        id: 'form__address_invalid',
                      });
                    }
                    return true;
                  },
                }}
                defaultValue=""
              >
                <Form.Textarea
                  // TODO different max length in network
                  maxLength={80}
                  placeholder={intl.formatMessage({ id: 'form__address' })}
                  borderRadius="12px"
                  h={{ base: 66, md: 58 }}
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
                  defaultValue={routeParamsToken?.id ?? nativeToken?.id}
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
                helpText={
                  <FormatCurrencyToken
                    token={selectedToken}
                    value={
                      isMax
                        ? getTokenBalance(selectedToken, '0')
                        : getValues('value')
                    }
                    render={(ele) => (
                      <Typography.Body2 mt={1} color="text-subdued">
                        {ele}
                      </Typography.Body2>
                    )}
                  />
                }
                rules={{
                  required: isMax
                    ? ''
                    : intl.formatMessage(
                        { id: 'form__amount_invalid' },
                        { 0: selectedToken?.symbol ?? '' },
                      ),
                  validate: (value) => {
                    const token = selectedToken;
                    if (!token) return undefined;
                    if (isMax) return undefined;
                    const inputBN = new BigNumber(value);
                    const balanceBN = new BigNumber(
                      getTokenBalance(token, '0'),
                    );
                    if (inputBN.isNaN() || balanceBN.isNaN()) {
                      return intl.formatMessage(
                        { id: 'form__amount_invalid' },
                        { 0: selectedToken?.symbol ?? '' },
                      );
                    }
                    if (balanceBN.isLessThan(inputBN)) {
                      return intl.formatMessage(
                        { id: 'form__amount_invalid' },
                        { 0: selectedToken?.symbol ?? '' },
                      );
                    }
                    return undefined;
                  },
                }}
              >
                <Form.NumberInput
                  maxLength={40}
                  w="100%"
                  size="xl"
                  decimal={
                    selectedToken && selectedToken.tokenIdOnNetwork
                      ? activeNetwork?.tokenDisplayDecimals
                      : activeNetwork?.nativeDisplayDecimals
                  }
                  rightText={selectedToken?.symbol ?? '-'}
                  enableMaxButton
                  isMax={isMax}
                  maxText={getTokenBalance(selectedToken, '')}
                  onMaxChange={(v) => {
                    setIsMax(v);
                    setTimeout(() => {
                      trigger('value');
                    }, 300);
                  }}
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
            <DecodeTxButtonTest encodedTx={encodedTx} />
          </>
        ),
      }}
    />
  );
};
export default React.memo(Transaction);
