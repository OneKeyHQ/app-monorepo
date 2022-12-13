import React, { FC, useCallback, useEffect, useRef } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { Animated } from 'react-native';

import {
  Box,
  Button,
  Center,
  HStack,
  Icon,
  IconButton,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks';
import { HomeRoutes, HomeRoutesParams } from '../../routes/types';
import { setSwapPopoverShown } from '../../store/reducers/status';

import { useSwapQuoteCallback } from './hooks/useSwap';
import { useWalletsSwapTransactions } from './hooks/useTransactions';

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
      <IconButton ml={2} type="plain" name="ClockMini" onPress={onPress} />
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
        <IconButton ml={2} type="plain" name="ClockMini" onPress={onPress} />
      )}
      {pendings.length > 0 ? (
        <Box
          position="absolute"
          w="2"
          h="2"
          bg="icon-warning"
          borderRadius="full"
          top="2"
          right="2"
        />
      ) : null}
    </Box>
  );
};

const RefreshButton = () => {
  const onSwapQuote = useSwapQuoteCallback({ showLoading: true });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const onRefresh = useCallback(() => {
    onSwapQuote();
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: -1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [onSwapQuote, fadeAnim]);

  return (
    <Button type="plain" onPress={onRefresh} pl="2" pr="2">
      <Animated.View
        style={{
          transform: [
            {
              rotate: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
        }}
      >
        <Icon name="ArrowPathMini" size={20} />
      </Animated.View>
    </Button>
  );
};

export const SwapHeaderButtons = () => (
  <HStack>
    {!platformEnv.isNative ? <RefreshButton /> : null}
    <HistoryButton />
  </HStack>
);

const SwapHeader = () => {
  const intl = useIntl();

  return (
    <Center w="full" mt={8} mb={6} px="4" zIndex={2}>
      <Box
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        maxW="768"
        width="full"
      >
        <Typography.DisplayLarge>
          {intl.formatMessage({ id: 'title__Swap_Bridge' })}
        </Typography.DisplayLarge>
        <SwapHeaderButtons />
      </Box>
    </Center>
  );
};

export default SwapHeader;
