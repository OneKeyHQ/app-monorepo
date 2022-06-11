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
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import {
  FormatBalanceToken,
  FormatCurrencyToken,
} from '../../components/Format';
import { useManageTokens } from '../../hooks';
import { useActiveWalletAccount } from '../../hooks/redux';
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

function PreSendAmountPreview({
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
    <Box flex={1} justifyContent="center">
      <Box height="140px" flexDirection="column" justifyContent="center">
        {!!title && (
          <Text
            height="24px"
            textAlign="center"
            typography={{ sm: 'DisplaySmall', md: 'Body1Strong' }}
            color="text-subdued"
          >
            {title}
          </Text>
        )}

        <Center flex={1}>
          <AutoSizeText text={text} onChangeText={onChangeText} />
        </Center>

        <Box height="24px">
          {loading ? (
            <Spinner size="sm" />
          ) : (
            !!desc && (
              <Text typography="DisplaySmall" textAlign="center">
                {desc}
              </Text>
            )
          )}
        </Box>
      </Box>
    </Box>
  );
}

function PreSendAmount() {
  const intl = useIntl();
  const { height } = useWindowDimensions();
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
      : network?.nativeDisplayDecimals) ?? '2';

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

  return (
    <BaseSendModal
      height="auto"
      header={intl.formatMessage({ id: 'content__amount' })}
      primaryActionTranslationId="action__next"
      hideSecondaryAction
      primaryActionProps={{
        isDisabled: !!errorMsg,
      }}
      onPrimaryActionPress={async () => {
        if (!account || !network || !tokenInfo) {
          return;
        }
        if (transferInfo) {
          transferInfo.amount = amount;
          transferInfo.from = account.address;
          transferInfo.max = new BigNumber(
            getTokenBalance({
              token: tokenInfo,
              defaultValue: '0',
            }),
          ).lte(amount);
        }

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
        <Box flexDirection="row" alignItems="center">
          <Typography.Body2Strong mr={3}>
            {intl.formatMessage({ id: 'content__to' })}
          </Typography.Body2Strong>
          <Typography.Body1>
            {shortenAddress(transferInfo?.to ?? '')}
          </Typography.Body1>
        </Box>
        <Box my={58}>
          <PreSendAmountPreview
            title={tokenInfo?.symbol ?? ''}
            text={amount}
            onChangeText={(text) => {
              if (validAmountRegex.test(text)) {
                console.log('PreSendAmountPreview onChangeText >>>>> ', text);
                setAmount(text);
              }
              // delete action
              if (text.length < amount.length) {
                setAmount(text);
              }
            }}
            desc={
              <FormatCurrencyToken
                token={tokenInfo}
                value={amount}
                render={(ele) => <Text>{ele}</Text>}
              />
            }
          />
        </Box>
        <Box flexDirection="row" alignItems="center">
          <Box flex={1}>
            <Typography.Caption>
              {intl.formatMessage({ id: 'content__available_balance' })}
            </Typography.Caption>
            <Box>
              <FormatBalanceToken
                token={tokenInfo}
                render={(ele) => (
                  <Text
                    color={errorMsg && amount ? 'text-critical' : undefined}
                    typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                  >
                    {ele}
                  </Text>
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
        <Box flex={1} />
        {(platformEnv.isNative || platformEnv.isDev) && (
          <Box>
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
    </BaseSendModal>
  );
}

export { PreSendAmount };
