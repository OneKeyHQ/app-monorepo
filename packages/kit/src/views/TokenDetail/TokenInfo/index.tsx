import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  IconButton,
  Token,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { TokenVerifiedIcon } from '@onekeyhq/components/src/Token';
import { getBalanceKey } from '@onekeyhq/engine/src/managers/token';
import type { Token as TokenDO } from '@onekeyhq/engine/src/types/token';
import { FormatBalance } from '@onekeyhq/kit/src/components/Format';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { FiatPayRoutes } from '@onekeyhq/kit/src/routes/Modal/FiatPay';
import { ReceiveTokenRoutes } from '@onekeyhq/kit/src/routes/Modal/routes';
import type { ReceiveTokenRoutesParams } from '@onekeyhq/kit/src/routes/Modal/types';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import {
  ModalRoutes,
  RootRoutes,
  TabRoutes,
} from '@onekeyhq/kit/src/routes/types';
import { SendRoutes } from '@onekeyhq/kit/src/views/Send/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccountTokensBalance } from '../../../hooks';
import { SWAP_TAB_NAME } from '../../../store/reducers/market';
import { ManageTokenRoutes } from '../../ManageTokens/types';

import { PriceCurrencyNumber } from './PriceCurrencyNumber';

type NavigationProps = ModalScreenProps<ReceiveTokenRoutesParams>;

export type TokenInfoProps = {
  token: TokenDO | null | undefined;
  priceReady?: boolean;
  sendAddress?: string;
};

const TokenInfo: FC<TokenInfoProps> = ({ token, priceReady, sendAddress }) => {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const { wallet, network, networkId, accountId, account } =
    useActiveWalletAccount();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const balances = useAccountTokensBalance(networkId, accountId);
  const { balance: amount } = balances[getBalanceKey(token)] ?? {
    balance: '0',
  };

  const [buyUrl, updateBuyUrl] = useState('');
  const [sellUrl, updateSellUrl] = useState('');
  useEffect(() => {
    backgroundApiProxy.serviceFiatPay
      .getFiatPayUrl({
        type: 'buy',
        address: account?.address,
        tokenAddress: token?.address,
        networkId: token?.networkId,
      })
      .then((url) => updateBuyUrl(url));
    backgroundApiProxy.serviceFiatPay
      .getFiatPayUrl({
        type: 'sell',
        address: account?.address,
        tokenAddress: token?.address,
        networkId: token?.networkId,
      })
      .then((url) => updateSellUrl(url));
  }, [account?.address, token?.address, token?.networkId, updateBuyUrl]);

  const goToWebView = useCallback(
    (signedUrl: string) => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.FiatPay,
        params: {
          screen: FiatPayRoutes.MoonpayWebViewModal,
          params: {
            url: signedUrl,
          },
        },
      });
    },
    [navigation],
  );

  const renderAccountAmountInfo = useMemo(
    () => (
      <Box flexDirection={isVertical ? 'column' : 'row'} alignItems="center">
        <Token
          size={12}
          showTokenVerifiedIcon
          token={{ ...token, logoURI: token?.logoURI || network?.logoURI }}
        />
        <Box
          ml={isVertical ? 0 : 4}
          alignItems={isVertical ? 'center' : 'flex-start'}
        >
          <Box flexDirection="row" mt={2} mx={isVertical ? 4 : 0}>
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
                  justifyContent="center"
                >
                  <Typography.DisplayXLarge
                    textAlign={isVertical ? 'center' : 'left'}
                    mr="2"
                  >
                    {ele}
                  </Typography.DisplayXLarge>
                  <TokenVerifiedIcon size={24} token={token || {}} />
                </Box>
              )}
            />
          </Box>
          <Typography.Body2 mt={1}>
            <PriceCurrencyNumber
              networkId={networkId}
              token={token}
              contractAdress={token?.tokenIdOnNetwork}
              balances={balances}
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
      networkId,
      balances,
    ],
  );

  const accountOption = useMemo(
    () => (
      <Box flexDirection="row" px={{ base: 1, md: 0 }} mx={-3}>
        <Box flex={1} mx={3} minW="56px" alignItems="center">
          <IconButton
            circle
            size={isVertical ? 'xl' : 'lg'}
            name="PaperAirplaneOutline"
            type="basic"
            isDisabled={wallet?.type === 'watching'}
            onPress={() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.Send,
                params: {
                  screen: SendRoutes.PreSendAddress,
                  params: {
                    accountId,
                    networkId,
                    from: '',
                    to: '',
                    amount: '',
                    token: token?.tokenIdOnNetwork ?? '',
                    sendAddress,
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
            name="QrCodeOutline"
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
        <Box flex={1} mx={3} minW="56px" alignItems="center">
          <IconButton
            circle
            size={isVertical ? 'xl' : 'lg'}
            name="ArrowsRightLeftOutline"
            type="basic"
            isDisabled={wallet?.type === 'watching'}
            onPress={() => {
              if (token) {
                backgroundApiProxy.serviceSwap.setInputToken(token);
              }
              if (isVertical) {
                backgroundApiProxy.serviceMarket.switchMarketTopTab(
                  SWAP_TAB_NAME,
                );
                navigation.getParent()?.navigate(TabRoutes.Market);
              } else {
                navigation.getParent()?.navigate(TabRoutes.Swap);
              }
            }}
          />
          <Typography.CaptionStrong
            textAlign="center"
            mt="8px"
            color={
              wallet?.type === 'watching' ? 'text-disabled' : 'text-default'
            }
          >
            {intl.formatMessage({ id: 'title__swap' })}
          </Typography.CaptionStrong>
        </Box>
        {isVertical ? null : (
          <>
            {buyUrl.length > 0 && (
              <Box flex={1} mx={3} minW="56px" alignItems="center">
                <IconButton
                  circle
                  size={isVertical ? 'xl' : 'lg'}
                  name="PlusOutline"
                  type="basic"
                  isDisabled={wallet?.type === 'watching'}
                  onPress={() => {
                    goToWebView(buyUrl);
                  }}
                />
                <Typography.CaptionStrong
                  textAlign="center"
                  mt="8px"
                  color={
                    wallet?.type === 'watching'
                      ? 'text-disabled'
                      : 'text-default'
                  }
                >
                  {intl.formatMessage({ id: 'action__buy' })}
                </Typography.CaptionStrong>
              </Box>
            )}
            {sellUrl.length > 0 && (
              <Box flex={1} mx={3} minW="56px" alignItems="center">
                <IconButton
                  circle
                  size={isVertical ? 'xl' : 'lg'}
                  name="CurrencyDollarOutline"
                  type="basic"
                  isDisabled={wallet?.type === 'watching'}
                  onPress={() => {
                    goToWebView(sellUrl);
                  }}
                />
                <Typography.CaptionStrong
                  textAlign="center"
                  mt="8px"
                  color={
                    wallet?.type === 'watching'
                      ? 'text-disabled'
                      : 'text-default'
                  }
                >
                  {intl.formatMessage({ id: 'action__sell' })}
                </Typography.CaptionStrong>
              </Box>
            )}
          </>
        )}
        {priceReady && !isVertical && (
          <Box flex={1} mx={3} minW="56px" alignItems="center">
            <IconButton
              circle
              size={isVertical ? 'xl' : 'lg'}
              name="BellOutline"
              type="basic"
              onPress={() => {
                navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.ManageToken,
                  params: {
                    screen: ManageTokenRoutes.PriceAlertList,
                    params: {
                      token: token as TokenDO,
                    },
                  },
                });
              }}
            />
            <Typography.CaptionStrong
              textAlign="center"
              mt="8px"
              color="text-default"
            >
              {intl.formatMessage({ id: 'form__price_alert' })}
            </Typography.CaptionStrong>
          </Box>
        )}
      </Box>
    ),
    [
      isVertical,
      wallet?.type,
      intl,
      buyUrl,
      sellUrl,
      priceReady,
      navigation,
      accountId,
      networkId,
      token,
      sendAddress,
      goToWebView,
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
