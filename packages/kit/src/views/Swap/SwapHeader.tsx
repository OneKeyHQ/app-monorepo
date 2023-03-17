/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { Animated } from 'react-native';

import {
  Box,
  Button,
  Center,
  HStack,
  Icon,
  IconButton,
  LottieView,
  Typography,
  useTheme,
  useThemeValue,
} from '@onekeyhq/components';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks';
import { HomeRoutes } from '../../routes/types';
import { setSwapPopoverShown } from '../../store/reducers/status';

import { doQuote } from './doQuote';
import { useSwapQuoteRequestParams } from './hooks/useSwap';
import { useWalletsSwapTransactions } from './hooks/useTransactions';
import { dangerRefs } from './refs';
import { SwapError } from './typings';

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
  const { themeVariant } = useTheme();
  const lottieRef = useRef<any>();
  const isFocused = useIsFocused();
  const total = 15000;

  const loadingAnim = useRef(new Animated.Value(0)).current;
  const processAnim = useRef(new Animated.Value(0)).current;
  const params = useSwapQuoteRequestParams();
  const error = useAppSelector((s) => s.swap.error);
  const limited = useAppSelector((s) => s.swap.quoteLimited);
  const loading = useAppSelector((s) => s.swap.loading);

  const isOk = useMemo(() => {
    if (error || limited || !params) {
      return false;
    }
    return true;
  }, [error, limited, params]);

  const lottie = useMemo(
    () => ({
      play: () => {
        lottieRef.current?.play?.();
        if (platformEnv.isNative) {
          const used = Number((processAnim as any)._value);
          Animated.timing(processAnim, {
            toValue: total,
            duration: total - used,
            useNativeDriver: true,
          }).start();
        }
      },
      reset: () => {
        lottieRef.current?.reset?.();
        if (platformEnv.isNative) {
          processAnim.stopAnimation();
          processAnim.setValue(0);
        }
      },
      pause: () => {
        lottieRef.current?.pause();
        if (platformEnv.isNative) {
          processAnim.stopAnimation();
        }
      },
    }),
    [lottieRef, processAnim],
  );

  const onRefresh = useCallback(() => {
    if (limited || !params || dangerRefs.submited) {
      loadingAnim.setValue(0);
      Animated.timing(loadingAnim, {
        toValue: -1,
        duration: 1000,
        useNativeDriver: true,
      }).start();
      return;
    }
    loadingAnim.setValue(0);
    lottie.pause();
    Animated.timing(loadingAnim, {
      toValue: -1,
      duration: 1000,
      useNativeDriver: true,
    }).start(async () => {
      lottie.reset();
      await doQuote({ params, loading: true });
      lottie.play();
    });
  }, [loadingAnim, limited, params, lottie]);

  useEffect(() => {
    const fn = processAnim.addListener(({ value }) => {
      if (value === total) {
        onRefresh();
      }
    });
    return () => processAnim.removeListener(fn);
  }, [onRefresh, processAnim]);

  useEffect(() => {
    appUIEventBus.on(AppUIEventBusNames.SwapRefresh, onRefresh);
    return () => {
      appUIEventBus.off(AppUIEventBusNames.SwapRefresh, onRefresh);
    };
  }, [onRefresh]);

  useEffect(() => {
    if (isOk && isFocused) {
      lottie.play();
    } else if (!isFocused) {
      lottie.pause();
    } else if (!isOk) {
      lottie.reset();
    }
  }, [isOk, isFocused, lottie]);

  return (
    <Button type="plain" onPress={onRefresh} pl="2" pr="2" isDisabled={loading}>
      <Animated.View
        style={{
          transform: [
            {
              rotate: loadingAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
        }}
      >
        <Center w="5" h="5">
          <LottieView
            onLoopComplete={onRefresh}
            ref={lottieRef}
            autoplay={false}
            // autoPlay={false}
            width={20}
            source={
              themeVariant === 'light'
                ? require('@onekeyhq/kit/assets/animations/lottie_onekey_swap_refresh_light.json')
                : require('@onekeyhq/kit/assets/animations/lottie_onekey_swap_refresh_dark.json')
            }
          />
        </Center>
      </Animated.View>
    </Button>
  );
};

export const SwapHeaderButtons = () => {
  const error = useAppSelector((s) => s.swap.error);

  return (
    <HStack>
      <Box position="relative">
        <RefreshButton />
        <Box
          position="absolute"
          display={error === SwapError.QuoteFailed ? 'flex' : 'none'}
          bottom="1"
          right="1"
          pointerEvents="none"
        >
          <Icon size={14} name="ExclamationCircleSolid" color="icon-critical" />
        </Box>
      </Box>
      <HistoryButton />
    </HStack>
  );
};

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
