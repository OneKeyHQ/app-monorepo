import React, { FC, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  IconButton,
  Token,
  TokenVerifiedIcon,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Token as TokenDO } from '@onekeyhq/engine/src/types/token';
import {
  FormatBalance,
  FormatCurrencyNumber,
} from '@onekeyhq/kit/src/components/Format';
import {
  useActiveWalletAccount,
  useFiatPay,
  useMoonpayPayCurrency,
} from '@onekeyhq/kit/src/hooks/redux';
import { useManageTokens } from '@onekeyhq/kit/src/hooks/useManageTokens';
import { FiatPayRoutes } from '@onekeyhq/kit/src/routes/Modal/FiatPay';
import { ReceiveTokenRoutes } from '@onekeyhq/kit/src/routes/Modal/routes';
import type { ReceiveTokenRoutesParams } from '@onekeyhq/kit/src/routes/Modal/types';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';
import { CurrencyType } from '@onekeyhq/kit/src/views/FiatPay/types';
import { SendRoutes } from '@onekeyhq/kit/src/views/Send/types';

import { getTokenValues } from '../../../utils/priceUtils';

type NavigationProps = ModalScreenProps<ReceiveTokenRoutesParams>;

export type TokenInfoProps = {
  token: TokenDO | null | undefined;
};

const TokenInfo: FC<TokenInfoProps> = ({ token }) => {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const { wallet, network } = useActiveWalletAccount();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const currencies = useFiatPay(network?.id ?? '');
  let cryptoCurrency = currencies.find((item) => {
    if (!token?.tokenIdOnNetwork) {
      return item.contract === '';
    }
    return item.contract === token?.tokenIdOnNetwork;
  });

  const { prices, balances } = useManageTokens();

  const amount = balances[token?.tokenIdOnNetwork || 'main'] ?? '0';

  if (cryptoCurrency) {
    cryptoCurrency = { ...cryptoCurrency, balance: amount };
  }
  const moonpayCurrency = useMoonpayPayCurrency(
    cryptoCurrency?.provider.moonpay,
  );

  const sellEnable = cryptoCurrency && moonpayCurrency?.isSellSupported;
  const renderAccountAmountInfo = useMemo(
    () => (
      <Box
        w="100%"
        flexDirection={isVertical ? 'column' : 'row'}
        alignItems="center"
      >
        <Token size={12} src={token?.logoURI ?? network?.logoURI} />
        <Box
          width="100%"
          flex={1}
          ml={isVertical ? 0 : 4}
          alignItems={isVertical ? 'center' : 'flex-start'}
        >
          <Box
            flex={1}
            width="100%"
            flexDirection="row"
            mt={2}
            mx={isVertical ? 4 : 0}
          >
            <FormatBalance
              balance={amount}
              suffix={token?.tokenIdOnNetwork ? token?.symbol : network?.symbol}
              formatOptions={{
                fixed:
                  (token?.tokenIdOnNetwork
                    ? network?.tokenDisplayDecimals
                    : network?.nativeDisplayDecimals) ?? 4,
              }}
              as={Typography.DisplayXLarge}
              render={(ele) => (
                <Box
                  flexDirection="row"
                  alignItems="center"
                  flex={1}
                  justifyContent="center"
                >
                  <Typography.DisplayXLarge
                    textAlign={isVertical ? 'center' : 'left'}
                  >
                    {ele}
                  </Typography.DisplayXLarge>
                  <TokenVerifiedIcon token={token || {}} />
                </Box>
              )}
            />
          </Box>
          <Typography.Body2 mt={1}>
            <FormatCurrencyNumber
              value={getTokenValues({ tokens: [token], prices, balances })[0]}
            />
          </Typography.Body2>
        </Box>
      </Box>
    ),
    [
      isVertical,
      token,
      network?.logoURI,
      network?.symbol,
      network?.tokenDisplayDecimals,
      network?.nativeDisplayDecimals,
      amount,
      prices,
      balances,
    ],
  );

  const accountOption = useMemo(
    () => (
      <Box>
        <Box flexDirection="row" px={{ base: 1, md: 0 }} mx={-3}>
          <Box flex={1} mx={3} minW="56px" alignItems="center">
            <IconButton
              circle
              size={isVertical ? 'xl' : 'lg'}
              name="ArrowUpOutline"
              type="basic"
              isDisabled={wallet?.type === 'watching'}
              onPress={() => {
                navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.Send,
                  params: {
                    screen: SendRoutes.PreSendAddress,
                    params: {
                      from: '',
                      to: '',
                      amount: '',
                      token: token?.tokenIdOnNetwork ?? '',
                    },
                  },
                });
              }}
            />
            <Typography.CaptionStrong
              textAlign="center"
              mt="8px"
              color={
                wallet?.type === 'watching' ? 'text-disabled' : 'text-default'
              }
            >
              {intl.formatMessage({ id: 'action__send' })}
            </Typography.CaptionStrong>
          </Box>
          <Box flex={1} mx={3} minW="56px" alignItems="center">
            <IconButton
              circle
              size={isVertical ? 'xl' : 'lg'}
              name="ArrowDownOutline"
              type="basic"
              isDisabled={wallet?.type === 'watching'}
              onPress={() => {
                navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.Receive,
                  params: {
                    screen: ReceiveTokenRoutes.ReceiveToken,
                    params: {},
                  },
                });
              }}
            />
            <Typography.CaptionStrong
              textAlign="center"
              mt="8px"
              color={
                wallet?.type === 'watching' ? 'text-disabled' : 'text-default'
              }
            >
              {intl.formatMessage({ id: 'action__receive' })}
            </Typography.CaptionStrong>
          </Box>
          {cryptoCurrency && (
            <Box flex={1} mx={3} minW="56px" alignItems="center">
              <IconButton
                circle
                size={isVertical ? 'xl' : 'lg'}
                name="PlusOutline"
                type="basic"
                isDisabled={wallet?.type === 'watching'}
                onPress={() => {
                  navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.FiatPay,
                    params: {
                      screen: FiatPayRoutes.AmountInputModal,
                      params: {
                        token: cryptoCurrency as CurrencyType,
                        type: 'Buy',
                      },
                    },
                  });
                }}
              />
              <Typography.CaptionStrong
                textAlign="center"
                mt="8px"
                color={
                  wallet?.type === 'watching' ? 'text-disabled' : 'text-default'
                }
              >
                {intl.formatMessage({ id: 'action__buy' })}
              </Typography.CaptionStrong>
            </Box>
          )}
          {sellEnable && (
            <Box flex={1} mx={3} minW="56px" alignItems="center">
              <IconButton
                circle
                size={isVertical ? 'xl' : 'lg'}
                name="CurrencyDollarOutline"
                type="basic"
                isDisabled={wallet?.type === 'watching'}
                onPress={() => {
                  navigation.navigate(RootRoutes.Modal, {
                    screen: ModalRoutes.FiatPay,
                    params: {
                      screen: FiatPayRoutes.AmountInputModal,
                      params: {
                        token: cryptoCurrency as CurrencyType,
                        type: 'Sell',
                      },
                    },
                  });
                }}
              />
              <Typography.CaptionStrong
                textAlign="center"
                mt="8px"
                color={
                  wallet?.type === 'watching' ? 'text-disabled' : 'text-default'
                }
              >
                {intl.formatMessage({ id: 'action__sell' })}
              </Typography.CaptionStrong>
            </Box>
          )}
        </Box>
      </Box>
    ),
    [
      isVertical,
      wallet?.type,
      intl,
      cryptoCurrency,
      sellEnable,
      navigation,
      token,
    ],
  );

  return useMemo(
    () => (
      <Box
        w="100%"
        py={isVertical ? 8 : 12}
        flexDirection={isVertical ? 'column' : 'row'}
        justifyContent={isVertical ? 'flex-start' : 'space-between'}
        alignItems={isVertical ? 'stretch' : 'center'}
        bgColor="background-default"
      >
        <Box w={isVertical ? 'full' : undefined}>{renderAccountAmountInfo}</Box>
        <Box
          mt={isVertical ? 8 : 0}
          alignItems={isVertical ? undefined : 'flex-end'}
          ml={isVertical ? undefined : 'auto'}
        >
          {accountOption}
        </Box>
      </Box>
    ),
    [isVertical, renderAccountAmountInfo, accountOption],
  );
};

export default TokenInfo;
