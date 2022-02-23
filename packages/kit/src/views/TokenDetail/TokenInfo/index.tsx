/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React, { FC, useEffect, useMemo, useState } from 'react';

import { useIsFocused, useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  IconButton,
  Token,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Token as TokenDO } from '@onekeyhq/engine/src/types/token';
import {
  FormatBalance,
  FormatCurrency,
} from '@onekeyhq/kit/src/components/Format';
import engine from '@onekeyhq/kit/src/engine/EngineProvider';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import {
  ModalNavigatorRoutes,
  ModalTypes,
} from '@onekeyhq/kit/src/routes/Modal';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Network } from '../../../store/reducers/network';
import extUtils from '../../../utils/extUtils';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ModalTypes,
  ModalNavigatorRoutes.ReceiveTokenNavigator
>;

export type TokenInfoProps = {
  accountId: string | null | undefined;
  token: TokenDO | null | undefined;
  network: Network | null | undefined;
};

const TokenInfo: FC<TokenInfoProps> = ({ accountId, token, network }) => {
  const isVertical = useIsVerticalLayout();
  const intl = useIntl();
  const isFocused = useIsFocused();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigation = useNavigation<NavigationProps>();

  const { wallet } = useActiveWalletAccount();
  const [amount, setAmount] = useState('0');
  const [tokenPrice, setTokenPrice] = useState<string>();

  useEffect(() => {
    async function main() {
      if (!accountId || !network?.id) return;
      const result = await engine.getAccountBalance(
        accountId,
        token?.networkId ?? network.id,
        token ? [token?.tokenIdOnNetwork] : [],
        true,
      );

      const prices = await engine.getPrices(
        network.id,
        token ? [token?.tokenIdOnNetwork] : [],
        !token,
      );

      if (token) {
        setAmount(result[token.tokenIdOnNetwork]?.toString() ?? '0');
        setTokenPrice(prices?.[token.tokenIdOnNetwork]);
      } else {
        setAmount(result.main?.toString() ?? '0');
        setTokenPrice(prices?.main);
      }
    }
    try {
      if (isFocused) main();
    } catch (error) {
      console.warn('TokenInfo', error);
    }
  }, [accountId, token, isFocused, network]);

  const renderAccountAmountInfo = useMemo(
    () => (
      <Box flexDirection={isVertical ? 'column' : 'row'} alignItems="center">
        <Token size={12} src={token?.logoURI ?? network?.logoURI} />
        <Box
          ml={isVertical ? 0 : 4}
          alignItems={isVertical ? 'center' : 'flex-start'}
        >
          <Box flexDirection="row" mt={2} mx={isVertical ? 4 : 0}>
            <FormatBalance
              balance={amount}
              suffix={token?.symbol}
              formatOptions={{
                fixed: network?.tokenDisplayDecimals ?? 4,
              }}
              as={Typography.DisplayXLarge}
            />
          </Box>
          <FormatCurrency
            numbers={[amount, tokenPrice]}
            render={(ele) => <Typography.Body2 mt={1}>{ele}</Typography.Body2>}
          />
        </Box>
      </Box>
    ),
    [
      isVertical,
      token?.logoURI,
      token?.symbol,
      network?.logoURI,
      network?.tokenDisplayDecimals,
      amount,
      tokenPrice,
    ],
  );

  const accountOption = useMemo(
    () => (
      <Box flexDirection="row" justifyContent="center" alignItems="center">
        <Button
          size={isVertical ? 'lg' : 'base'}
          leftIconName="ArrowUpSolid"
          minW={{ base: '126px', md: 'auto' }}
          isDisabled={wallet?.type === 'watching'}
          type="basic"
          // onPress={() => {
          //   navigation.navigate(ModalNavigatorRoutes.SendNavigator, {
          //     screen: ModalRoutes.Send,
          //   });
          // }}
        >
          {intl.formatMessage({ id: 'action__send' })}
        </Button>
        <Button
          isDisabled={wallet?.type === 'watching'}
          size={isVertical ? 'lg' : 'base'}
          ml={4}
          leftIconName="ArrowDownSolid"
          minW={{ base: '126px', md: 'auto' }}
          type="basic"
          // onPress={() => {
          //   navigation.navigate(ModalNavigatorRoutes.ReceiveTokenNavigator, {
          //     screen: ModalRoutes.ReceiveToken,
          //     params: { address: '0x4330b96cde5bf063f21978870ff193ae8cae4c48' },
          //   });
          // }}
        >
          {intl.formatMessage({ id: 'action__receive' })}
        </Button>
        {platformEnv.isExtensionUiPopup && (
          <IconButton
            onPress={() => {
              extUtils.openExpandTab({ route: '/' });
            }}
            ml={4}
            name="ArrowsExpandOutline"
          />
        )}
      </Box>
    ),
    [intl, isVertical, wallet?.type],
  );

  return useMemo(
    () => (
      <Box
        w="100%"
        py={isVertical ? 8 : 12}
        px={isVertical ? 0 : 4}
        flexDirection={isVertical ? 'column' : 'row'}
        justifyContent={isVertical ? 'flex-start' : 'space-between'}
        alignItems={isVertical ? 'stretch' : 'center'}
        bgColor="background-default"
      >
        <Box w="100%" flex={1}>
          {renderAccountAmountInfo}
        </Box>
        <Box mt={isVertical ? 8 : 0}>{accountOption}</Box>
      </Box>
    ),
    [isVertical, renderAccountAmountInfo, accountOption],
  );
};

export default TokenInfo;
