import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  Button,
  Center,
  HStack,
  IconButton,
  Keyboard,
  Spinner,
  Text,
  Typography,
  useIsVerticalLayout,
  useToast,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { Token } from '@onekeyhq/engine/src/types/token';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  FormatBalanceToken,
  FormatCurrencyToken,
} from '../../components/Format';
import { useActiveWalletAccount, useManageTokens } from '../../hooks';
import { useSettings } from '../../hooks/redux';
import { useTokenInfo } from '../../hooks/useTokenInfo';
import { INetwork } from '../../store/reducers/runtime';
import { AutoSizeText } from '../FiatPay/AmountInput/AutoSizeText';

import { BaseSendModal } from './components/BaseSendModal';
import { SendRoutes, SendRoutesParams } from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendRoutes.PreSendAmount
>;
type RouteProps = RouteProp<SendRoutesParams, SendRoutes.PreSendAmount>;

export function PreSendAmountPreview({
  title,
  titleAction,
  text,
  onChangeText,
  loading,
  desc,
}: {
  text: string;
  onChangeText?: (text: string) => void;
  title?: string;
  titleAction?: JSX.Element;
  desc?: string | JSX.Element;
  loading?: boolean;
}) {
  return (
    <Box height="140px">
      {!!title && (
        <HStack space={2} alignItems="center" justifyContent="center">
          <Text
            textAlign="center"
            typography="DisplayLarge"
            color="text-subdued"
          >
            {title}
          </Text>
          {titleAction}
        </HStack>
      )}

      {/* placeholder={intl.formatMessage({ id: 'content__amount' })} */}
      <Center flex={1} maxH="64px" mt={2} mb={3}>
        <AutoSizeText
          autoFocus
          text={text}
          onChangeText={onChangeText}
          placeholder="0"
        />
      </Center>

      {loading ? (
        <Spinner size="sm" />
      ) : (
        !!desc && (
          <Text typography="Body1Strong" textAlign="center" isTruncated>
            {desc}
          </Text>
        )
      )}
    </Box>
  );
}

function usePreSendAmountInfo({
  tokenInfo,
  desc,
  network,
  amount,
  setAmount,
  tokenBalance,
}: {
  tokenInfo: Token | undefined;
  desc?: JSX.Element;
  network?: INetwork | null;
  amount: string;
  setAmount: (value: string) => void;
  tokenBalance: string;
}) {
  const amountInputDecimals =
    (tokenInfo?.tokenIdOnNetwork
      ? network?.tokenDisplayDecimals
      : network?.nativeDisplayDecimals) ?? 2;

  const validAmountRegex = useMemo(() => {
    const pattern = `^(0|([1-9][0-9]*))?\\.?([0-9]{1,${amountInputDecimals}})?$`;
    return new RegExp(pattern);
  }, [amountInputDecimals]);
  const { getTokenPrice } = useManageTokens();
  const { selectedFiatMoneySymbol = 'usd' } = useSettings();
  const fiatUnit = selectedFiatMoneySymbol.toUpperCase().trim();
  const [isFiatMode, setIsFiatMode] = useState(false);
  const [text, setText] = useState(amount);
  const tokenPriceBN = useMemo(
    () =>
      new BigNumber(
        getTokenPrice({
          token: tokenInfo,
        }),
      ),
    [getTokenPrice, tokenInfo],
  );
  const hasTokenPrice = !tokenPriceBN.isNaN() && tokenPriceBN.gt(0);
  const getInputText = useCallback(
    (isFiatMode0: boolean, amount0: string, roundMode = undefined) => {
      if (isFiatMode0) {
        if (!amount0) {
          return '';
        }
        return tokenPriceBN.times(amount0 || '0').toFixed(2, roundMode);
      }
      return amount0;
    },
    [tokenPriceBN],
  );
  const setTextByAmount = useCallback(
    (amount0: string) => {
      const text0 = getInputText(isFiatMode, amount0, BigNumber.ROUND_FLOOR);
      setText(text0);
    },
    [getInputText, isFiatMode],
  );
  const onTextChange = (t: string) => setText(t);
  const onAmountChange = useCallback(
    (text0: string) => {
      // delete action
      if (text0.length < amount.length) {
        setAmount(text0);
        return;
      }
      if (validAmountRegex.test(text0)) {
        setAmount(text0);
      } else {
        const textBN = new BigNumber(text0);
        if (!textBN.isNaN()) {
          const textFixed = textBN.toFixed(
            amountInputDecimals,
            BigNumber.ROUND_FLOOR,
          );
          setAmount(textFixed);
        }
      }
    },
    [amount.length, amountInputDecimals, setAmount, validAmountRegex],
  );
  const titleActionButton = (
    <IconButton
      name="SwitchVerticalOutline"
      size="lg"
      type="plain"
      circle
      onPress={() => {
        let roundingMode;
        // max amount
        if (text && text === tokenBalance && !isFiatMode) {
          roundingMode = BigNumber.ROUND_FLOOR;
        }
        const isFiatModeNew = !isFiatMode;
        setIsFiatMode(isFiatModeNew);
        setText(getInputText(isFiatModeNew, amount, roundingMode));
      }}
    />
  );
  const descView = useMemo(() => {
    if (desc) {
      return desc;
    }
    if (isFiatMode) {
      return (
        <Text>
          {amount || '0'} {tokenInfo?.symbol}
        </Text>
      );
    }
    return (
      <FormatCurrencyToken
        token={tokenInfo}
        value={amount}
        render={(ele) => <Text>{ele}</Text>}
      />
    );
  }, [amount, desc, isFiatMode, tokenInfo]);
  useEffect(() => {
    if (isFiatMode) {
      if (!text) {
        return onAmountChange('');
      }
      return onAmountChange(new BigNumber(text).div(tokenPriceBN).toFixed());
    }
    return onAmountChange(text);
  }, [isFiatMode, onAmountChange, text, tokenPriceBN]);

  return {
    validAmountRegex,
    title: (isFiatMode ? fiatUnit : tokenInfo?.symbol) ?? '--',
    titleAction: hasTokenPrice ? titleActionButton : undefined,
    isFiatMode,
    descView,
    text,
    onTextChange,
    setTextByAmount,
  };
}

function PreSendAmount() {
  const intl = useIntl();
  const toast = useToast();
  const { height } = useWindowDimensions();
  const isSmallScreen = useIsVerticalLayout();
  const [isLoading, setIsLoading] = useState(false);
  const shortScreen = height < 768;
  // const space = shortScreen ? '16px' : '24px';
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const transferInfo = { ...route.params };
  const [amount, setAmount] = useState('');
  const { account, accountId, networkId, network } = useActiveWalletAccount();
  const { engine } = backgroundApiProxy;

  const tokenIdOnNetwork = transferInfo.token;
  const tokenInfo = useTokenInfo({
    networkId,
    tokenIdOnNetwork,
  });

  const { getTokenBalance } = useManageTokens({
    fetchTokensOnMount: true,
  });

  const tokenBalance = useMemo(
    () =>
      getTokenBalance({
        token: tokenInfo,
        defaultValue: '0',
      }),
    [getTokenBalance, tokenInfo],
  );

  const getAmountValidateError = useCallback(() => {
    if (!tokenInfo || !amount) {
      return 'error';
    }
    const inputBN = new BigNumber(amount);
    const balanceBN = new BigNumber(tokenBalance);
    if (inputBN.isNaN() || balanceBN.isNaN()) {
      return intl.formatMessage(
        { id: 'form__amount_invalid' },
        { 0: tokenInfo?.symbol ?? '' },
      );
    }
    if (balanceBN.isLessThan(inputBN)) {
      return intl.formatMessage(
        { id: 'form__amount_invalid' },
        { 0: tokenInfo?.symbol ?? '' },
      );
    }
    return undefined;
  }, [amount, intl, tokenBalance, tokenInfo]);
  const errorMsg = getAmountValidateError();

  const minAmountBN = useMemo(
    () => new BigNumber(network?.settings.minTransferAmount || '0'),
    [network],
  );

  const [minAmountValidationPassed, minAmountNoticeNeeded] = useMemo(() => {
    const minAmountRequired = !minAmountBN.isNaN() && minAmountBN.gt('0');

    if (minAmountRequired) {
      const amountBN = new BigNumber(amount);
      if (amountBN.isNaN()) {
        return [false, false];
      }
      if (amountBN.lt(minAmountBN)) {
        return [false, amountBN.gt('0')];
      }
    }
    return [true, false];
  }, [minAmountBN, amount]);

  const desc = useMemo(
    () =>
      minAmountNoticeNeeded ? (
        <Typography.Body1Strong color="text-critical">
          {intl.formatMessage(
            { id: 'form__str_minimum_transfer' },
            { 0: minAmountBN.toFixed(), 1: tokenInfo?.symbol },
          )}
        </Typography.Body1Strong>
      ) : undefined,
    [intl, minAmountBN, minAmountNoticeNeeded, tokenInfo?.symbol],
  );

  const {
    title,
    titleAction,
    descView,
    text,
    onTextChange,
    validAmountRegex,
    setTextByAmount,
    isFiatMode,
  } = usePreSendAmountInfo({
    tokenInfo,
    desc,
    network,
    amount,
    setAmount,
    tokenBalance,
  });

  return (
    <BaseSendModal
      header={intl.formatMessage({ id: 'content__amount' })}
      primaryActionTranslationId="action__next"
      hideSecondaryAction
      primaryActionProps={{
        isDisabled: !!errorMsg || !minAmountValidationPassed,
        isLoading,
      }}
      onPrimaryActionPress={async () => {
        if (!account || !network || !tokenInfo) {
          return;
        }
        const amountToSend = isFiatMode ? amount : text;
        if (transferInfo) {
          transferInfo.amount = amountToSend;
          transferInfo.from = account.address;
        }

        try {
          setIsLoading(true);
          const encodedTx = await engine.buildEncodedTxFromTransfer({
            networkId,
            accountId,
            transferInfo,
          });

          navigation.navigate(SendRoutes.SendConfirm, {
            encodedTx,
            feeInfoUseFeeInTx: false,
            feeInfoEditable: true,
            backRouteName: SendRoutes.PreSendAddress,
            payload: {
              payloadType: 'Transfer',
              account,
              network,
              token: {
                ...tokenInfo,
                idOnNetwork: tokenInfo?.tokenIdOnNetwork ?? '',
              },
              to: transferInfo.to,
              value: amountToSend,
              isMax: false,
            },
          });
        } catch (e: any) {
          console.error(e);
          const { key: errorKey = '' } = e;
          if (errorKey === 'form__amount_invalid') {
            toast.show({
              title: intl.formatMessage(
                { id: 'form__amount_invalid' },
                { 0: tokenInfo?.symbol ?? '' },
              ),
            });
          }
        } finally {
          setIsLoading(false);
        }
      }}
    >
      <Box
        flex={1}
        flexDirection="column"
        style={{
          // @ts-ignore
          userSelect: 'none',
        }}
      >
        <Box flexDirection="row" alignItems="baseline">
          <Typography.Body2Strong mr={2} color="text-subdued">
            {intl.formatMessage({ id: 'content__to' })}:
          </Typography.Body2Strong>
          <Typography.Body1>
            {shortenAddress(transferInfo?.to ?? '')}
          </Typography.Body1>
        </Box>
        <Box
          py={isSmallScreen ? 4 : undefined}
          my={6}
          flex={1}
          justifyContent="center"
        >
          <PreSendAmountPreview
            title={title}
            titleAction={titleAction}
            desc={descView}
            text={text}
            onChangeText={onTextChange}
          />
        </Box>
        <Box mt="auto">
          <Box flexDirection="row" alignItems="center">
            <Box flex={1}>
              <Typography.Caption color="text-subdued">
                {intl.formatMessage({ id: 'content__available_balance' })}
              </Typography.Caption>
              <Box>
                <FormatBalanceToken
                  token={tokenInfo}
                  render={(ele) => (
                    <Typography.Body1Strong
                      color={
                        errorMsg && amount ? 'text-critical' : 'text-default'
                      }
                    >
                      {ele}
                    </Typography.Body1Strong>
                  )}
                />
              </Box>
            </Box>
            <Button
              onPress={() => {
                setTextByAmount(tokenBalance ?? '0');
              }}
            >
              {intl.formatMessage({ id: 'action__max' })}
            </Button>
          </Box>
          {(platformEnv.isNative || (platformEnv.isDev && isSmallScreen)) && (
            <Box mt={6}>
              <Keyboard
                itemHeight={shortScreen ? '44px' : undefined}
                // pattern={/^(0|([1-9][0-9]*))?\.?([0-9]{1,2})?$/}
                pattern={validAmountRegex}
                text={text}
                onTextChange={onTextChange}
              />
            </Box>
          )}
        </Box>
      </Box>
    </BaseSendModal>
  );
}

export { PreSendAmount };
