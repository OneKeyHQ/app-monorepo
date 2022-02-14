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
import {
  ModalNavigatorRoutes,
  ModalTypes,
} from '@onekeyhq/kit/src/routes/Modal';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import extUtils from '../../../utils/extUtils';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ModalTypes,
  ModalNavigatorRoutes.ReceiveTokenNavigator
>;

export type TokenInfoProps = {
  token: any;
};

const TokenInfo: FC<TokenInfoProps> = ({ token }) => {
  const isVertical = useIsVerticalLayout();
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  const renderAccountAmountInfo = useMemo(
    () => (
      <Box flexDirection={isVertical ? 'column' : 'row'} alignItems="center">
        <Token size={12} src={token.logoURI} />
        <Box
          ml={isVertical ? 0 : 4}
          alignItems={isVertical ? 'center' : 'flex-start'}
        >
          <Box flexDirection="row" mt={2} mx={isVertical ? 4 : 0}>
            <Typography.DisplayXLarge>{token.amount}</Typography.DisplayXLarge>
            <Typography.DisplayXLarge pl={2}>
              {token.symbol}
            </Typography.DisplayXLarge>
          </Box>
          <Typography.Body2 mt={1}>{token.fiatAmount}</Typography.Body2>
        </Box>
      </Box>
    ),
    [token, isVertical],
  );

  const accountOption = useMemo(
    () => (
      <Box flexDirection="row" justifyContent="center" alignItems="center">
        <Button
          size={isVertical ? 'lg' : 'base'}
          leftIconName="ArrowUpSolid"
          minW={{ base: '126px', md: 'auto' }}
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
    [intl, isVertical, navigation],
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
