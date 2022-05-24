/* eslint-disable no-nested-ternary, @typescript-eslint/no-unused-vars */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import deepEqual from 'dequal';
import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  Form,
  Modal,
  Typography,
  useForm,
  useFormState,
} from '@onekeyhq/components';
import { FormErrorMessage } from '@onekeyhq/components/src/Form/FormErrorMessage';
import type { SelectItem } from '@onekeyhq/components/src/Select';
import { ITransferInfo } from '@onekeyhq/engine/src/vaults/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useManageTokens } from '@onekeyhq/kit/src/hooks/useManageTokens';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { FormatBalance, FormatCurrencyToken } from '../../components/Format';
import { useActiveWalletAccount } from '../../hooks/redux';
import { useOnboardingFinished } from '../../hooks/useOnboardingFinished';

import { DecodeTxButtonTest } from './DecodeTxButtonTest';
import { FeeInfoInputForTransfer } from './FeeInfoInput';
import {
  SendConfirmParams,
  SendRoutes,
  SendRoutesParams,
  TransferSendParamsPayload,
} from './types';
import {
  FEE_INFO_POLLING_INTERVAL,
  useFeeInfoPayload,
} from './useFeeInfoPayload';

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

// TODO useDebounce instead
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
  500,
  { leading: false, trailing: true },
);

const Transaction = () => {
  // const encodedTxRef = useRef<any>(null);
  useOnboardingFinished();
  const [encodedTx, setEncodedTx] = useState(null);
  const [transferError, setTransferError] = useState<Error | null>(null);
  const navigation = useNavigation<NavigationProps>();
  const [isMax, setIsMax] = useState(false);
  const route = useRoute<RouteProps>();
  const routeParamsToken = route?.params?.token;

  const {
    control,
    handleSubmit,
    watch,
    trigger,
    getValues,
    setValue,
    clearErrors,
  } = useForm<TransactionValues>({
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
  const { feeInfoPayload, feeInfoLoading, feeInfoError } = useFeeInfoPayload({
    encodedTx,
    pollingInterval: FEE_INFO_POLLING_INTERVAL,
  });
  const intl = useIntl();

  const { nativeToken, accountTokens, balances, getTokenBalance } =
    useManageTokens({
      fetchTokensOnMount: true,
    });
  // selected token
  const [selectOption, setSelectOption] = useState<Option | null>(null);

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
      // transferInfo.amount === '' // empty value will show loading text
      return;
    }
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
            setTransferError(null);
          }
        } catch (e) {
          console.error(e);
          setTransferError(e as Error);
        }
      },
    });
  }, [accountId, isValid, networkId, transferInfo]);

  const updateTransferInfo = useCallback(() => {
    const formValues = getValues();
    let { to, value } = formValues;
    const from = (account as { address: string }).address;
    if (isMax) {
      // max token transfer
      if (selectedToken?.tokenIdOnNetwork) {
        value = getTokenBalance(selectedToken, '');
      } else {
        value = '0';
      }
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

  const revalidateAmountInput = useCallback(() => {
    setTimeout(() => {
      if (getValues('value')) {
        trigger('value');
      } else {
        clearErrors('value');
      }
    }, 300);
  }, [clearErrors, getValues, trigger]);

  // form data changed watch handler
  useEffect(() => {
    const subscription = watch((formValues, { name, type }) => {
      updateTransferInfo();
      if (type === 'change' && name === 'token') {
        const option = tokenOptions.find((o) => o.value === formValues.token);
        if (option) {
          setSelectOption(option);
          revalidateAmountInput();
        }
      }
      if (type === 'change' && name === 'value') {
        revalidateAmountInput();
      }
    });
    return () => subscription.unsubscribe();
  }, [
    watch,
    tokenOptions,
    trigger,
    updateTransferInfo,
    setValue,
    revalidateAmountInput,
  ]);

  const submitButtonDisabled =
    !isValid ||
    feeInfoLoading ||
    !feeInfoPayload ||
    !feeInfoPayload.current.total ||
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
      payloadType: 'Transfer',
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
    const params: SendConfirmParams = {
      payloadType: 'transfer', // transfer, transferNft, swap
      payload,
      backRouteName: SendRoutes.Send,
      encodedTx: encodedTxWithFee,
      feeInfoSelected: feeInfoPayload?.selected,
      feeInfoEditable: false,
      feeInfoUseFeeInTx: true,
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
                labelAddon={platformEnv.isExtension ? [] : ['paste', 'scan']}
                onLabelAddonPress={() => trigger('to')} // call validation after paste
                control={control}
                name="to"
                formControlProps={{ width: 'full' }}
                rules={{
                  // required is NOT needed, as submit button should be disabled
                  // required: intl.formatMessage({ id: 'form__address_invalid' }),
                  validate: async (toAddress) => {
                    if (!toAddress) {
                      return undefined;
                    }
                    try {
                      await backgroundApiProxy.validator.validateAddress(
                        networkId,
                        toAddress,
                      );
                    } catch (error0) {
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
                  // required is NOT needed, as submit button should be disable
                  validate: (value) => {
                    const token = selectedToken;
                    if (!token) return undefined;
                    if (isMax) return undefined;
                    if (!value) return undefined;
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
                  w="full"
                  size="xl"
                  maxLength={40}
                  decimal={
                    selectedToken && selectedToken.tokenIdOnNetwork
                      ? activeNetwork?.tokenDisplayDecimals
                      : activeNetwork?.nativeDisplayDecimals
                  }
                  tokenSymbol={selectedToken?.symbol ?? '-'}
                  enableMaxButton
                  isMax={isMax}
                  maxText={getTokenBalance(selectedToken, '')}
                  maxTextIsNumber
                  maxModeCanEdit
                  onMaxChange={(v) => {
                    setIsMax(v);
                    revalidateAmountInput();
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
                  editable
                />
                <FormErrorMessage message={feeInfoError?.message ?? ''} />
                <FormErrorMessage message={transferError?.message ?? ''} />
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
