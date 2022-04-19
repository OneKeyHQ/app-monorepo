/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React, { FC, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
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
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { useManageTokens } from '@onekeyhq/kit/src/hooks/useManageTokens';
import { ReceiveTokenRoutes } from '@onekeyhq/kit/src/routes/Modal/routes';
import type { ReceiveTokenRoutesParams } from '@onekeyhq/kit/src/routes/Modal/types';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';
import { INetwork } from '@onekeyhq/kit/src/store/reducers/runtime';
import extUtils from '@onekeyhq/kit/src/utils/extUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type NavigationProps = ModalScreenProps<ReceiveTokenRoutesParams>;

export type TokenInfoProps = {
  token: TokenDO | null | undefined;
  network: INetwork | null | undefined;
};

const TokenInfo: FC<TokenInfoProps> = ({ token, network }) => {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { wallet, account } = useActiveWalletAccount();
  const { prices, balances } = useManageTokens();
  const tokenPrice = prices[token?.tokenIdOnNetwork ?? 'main'];
  const amount = balances[token?.tokenIdOnNetwork || 'main'] ?? '0';

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
              render={(ele) => (
                <Typography.DisplayXLarge>{ele}</Typography.DisplayXLarge>
              )}
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
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Receive,
              params: {
                screen: ReceiveTokenRoutes.ReceiveToken,
                params: {
                  address: (account as any)?.address,
                  name: '',
                },
              },
            });
          }}
        >
          {intl.formatMessage({ id: 'action__receive' })}
        </Button>
        {platformEnv.isExtensionUiPopup && platformEnv.isDev && (
          <IconButton
            onPress={() => {
              extUtils.openExpandTab({ routes: '' });
            }}
            ml={4}
            name="ArrowsExpandOutline"
          />
        )}
      </Box>
    ),
    [intl, isVertical, wallet?.type, account, navigation],
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
