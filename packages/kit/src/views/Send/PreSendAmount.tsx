import React, { useCallback, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  Button,
  Center,
  Keyboard,
  Spinner,
  Text,
  Typography,
  useIsVerticalLayout,
  useToast,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  FormatBalanceToken,
  FormatCurrencyToken,
} from '../../components/Format';
import { useActiveWalletAccount, useManageTokens } from '../../hooks';
import { useTokenInfo } from '../../hooks/useTokenInfo';
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
  text,
  onChangeText,
  loading,
  desc,
}: {
  text: string;
  onChangeText?: (text: string) => void;
  title?: string;
  desc?: string | JSX.Element;
  loading?: boolean;
}) {
  return (
    <Box height="140px">
      {!!title && (
        <Text textAlign="center" typography="DisplayLarge" color="text-subdued">
          {title}
        </Text>
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

  const amountInputDecimals =
    (tokenIdOnNetwork
      ? network?.tokenDisplayDecimals
      : network?.nativeDisplayDecimals) ?? 2;

  const validAmountRegex = useMemo(() => {
    const pattern = `^(0|([1-9][0-9]*))?\\.?([0-9]{1,${amountInputDecimals}})?$`;
    return new RegExp(pattern);
  }, [amountInputDecimals]);

  const { getTokenBalance } = useManageTokens({
    fetchTokensOnMount: true,
  });

  const getAmountValidateError = useCallback(() => {
    if (!tokenInfo || !amount) {
      return 'error';
    }
    const inputBN = new BigNumber(amount);
    const balanceBN = new BigNumber(
      getTokenBalance({
        token: tokenInfo,
        defaultValue: '0',
      }),
    );
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
  }, [amount, getTokenBalance, intl, tokenInfo]);
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
        if (transferInfo) {
          transferInfo.amount = amount;
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
              value: amount,
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
            title={tokenInfo?.symbol ?? '--'}
            text={amount}
            onChangeText={(text) => {
              // delete action
              if (text.length < amount.length) {
                setAmount(text);
                return;
              }
              if (validAmountRegex.test(text)) {
                setAmount(text);
              } else {
                const textBN = new BigNumber(text);
                if (!textBN.isNaN()) {
                  const textFixed = textBN.toFixed(
                    amountInputDecimals,
                    BigNumber.ROUND_FLOOR,
                  );
                  setAmount(textFixed);
                }
              }
            }}
            desc={
              minAmountNoticeNeeded ? (
                <Typography.Body1Strong color="text-critical">
                  {intl.formatMessage(
                    { id: 'form__str_minimum_transfer' },
                    { 0: minAmountBN.toFixed() },
                  )}
                </Typography.Body1Strong>
              ) : (
                <FormatCurrencyToken
                  token={tokenInfo}
                  value={amount}
                  render={(ele) => <Text>{ele}</Text>}
                />
              )
            }
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
                const balance = getTokenBalance({
                  token: tokenInfo,
                  defaultValue: '0',
                });
                setAmount(balance ?? '0');
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
                onTextChange={(text) => {
                  // updateInputText(text);
                  console.log(text);
                  setAmount(text);
                }}
              />
            </Box>
          )}
        </Box>
      </Box>
    </BaseSendModal>
  );
}

export { PreSendAmount };
