/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import type { FC } from 'react';
import { useCallback, useEffect } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  IconButton,
  Pressable,
  ToastManager,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks';
import { HomeRoutes } from '../../routes/types';
import { setSwapPopoverShown } from '../../store/reducers/status';
import { setMode } from '../../store/reducers/swap';

import { limitOrderNetworkIds } from './config';
import { useWalletsSwapTransactions } from './hooks/useTransactions';

import type { HomeRoutesParams } from '../../routes/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<HomeRoutesParams>;

const HistoryPopoverButton: FC<{ onPress?: () => void }> = ({ onPress }) => {
  const intl = useIntl();
  const borderBottomColor = useThemeValue('surface-success-default');
  useEffect(() => {
    const timer = setTimeout(
      () => backgroundApiProxy.dispatch(setSwapPopoverShown()),
      8 * 1000,
    );
    return () => {
      clearTimeout(timer);
      backgroundApiProxy.dispatch(setSwapPopoverShown());
    };
  }, []);
  return (
    <Box position="relative">
      <IconButton type="plain" name="ClockOutline" onPress={onPress} />
      <Box
        position="absolute"
        zIndex={1}
        top="full"
        right={0}
        bg="surface-success-default"
        borderRadius={12}
        width="56"
      >
        <Box
          style={{
            width: 0,
            height: 0,
            backgroundColor: 'transparent',
            borderStyle: 'solid',
            borderLeftWidth: 5,
            borderRightWidth: 5,
            borderBottomWidth: 10,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor,
            position: 'absolute',
            top: -8,
            right: 14,
          }}
        />
        <Box p="3">
          <Typography.Body2>
            {intl.formatMessage({
              id: 'msg__you_can_find_your_transaction_history_here',
            })}
          </Typography.Body2>
        </Box>
      </Box>
    </Box>
  );
};

const HistoryButton = () => {
  const transactions = useWalletsSwapTransactions();
  const swapPopoverShown = useAppSelector((s) => s.status.swapPopoverShown);
  const pendings = transactions.filter(
    (tx) => tx.status === 'pending' && tx.type === 'swap',
  );
  const navigation = useNavigation<NavigationProps>();
  const onPress = useCallback(() => {
    navigation.navigate(HomeRoutes.SwapHistory);
  }, [navigation]);
  return (
    <Box position="relative">
      {!swapPopoverShown && pendings.length > 0 ? (
        <HistoryPopoverButton onPress={onPress} />
      ) : (
        <IconButton type="plain" name="ClockOutline" onPress={onPress} />
      )}
      {pendings.length > 0 ? (
        <Box
          position="absolute"
          w="2"
          h="2"
          bg="icon-warning"
          borderRadius="full"
          top="1"
          right="1"
        />
      ) : null}
    </Box>
  );
};

export const SwapHeaderButtons = () => <HistoryButton />;

export const SwapHeaderSwitch = () => {
  const intl = useIntl();
  const swapMode = useAppSelector((s) => s.swap.mode);
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const isSwap = swapMode === 'swap';

  const setLimitOrderMode = useCallback(() => {
    if (!inputToken || !limitOrderNetworkIds.includes(inputToken.networkId)) {
      ToastManager.show(
        {
          title: intl.formatMessage(
            {
              id: 'limit_orders_are_only_supported_for_str',
            },
            { '0': 'ETH, BSC, Polygon' },
          ),
        },
        { type: 'default' },
      );
    }
    backgroundApiProxy.serviceLimitOrder.setDefaultTokens();
    backgroundApiProxy.dispatch(setMode('limit'));
  }, [inputToken, intl]);

  return (
    <Box flexDirection="row" alignItems="center" h="30px">
      <Pressable
        mr="3"
        onPress={() => backgroundApiProxy.dispatch(setMode('swap'))}
      >
        <Typography.Body1Strong
          color={isSwap ? 'text-default' : 'text-disabled'}
        >
          {intl.formatMessage({ id: 'title__swap' })}
        </Typography.Body1Strong>
      </Pressable>
      <Pressable
        onPress={setLimitOrderMode}
        flexDirection="row"
        alignItems="center"
      >
        <Typography.Body1Strong
          color={!isSwap ? 'text-default' : 'text-disabled'}
        >
          {intl.formatMessage({ id: 'form__limit' })}
        </Typography.Body1Strong>
        <Box ml="1">
          <Badge type="info" size="sm" title="Beta" />
        </Box>
      </Pressable>
    </Box>
  );
};

export const SwapHeader = () => (
  <Box
    width="full"
    flexDirection="row"
    h="9"
    justifyContent="space-between"
    alignItems="center"
  >
    <SwapHeaderSwitch />
    <SwapHeaderButtons />
  </Box>
);
