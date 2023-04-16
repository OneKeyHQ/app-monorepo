/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { Animated } from 'react-native';

import { Box, Center, Icon, LottieView, useTheme } from '@onekeyhq/components';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAppSelector } from '../../../../hooks';
import { doQuote } from '../../doQuote';
import { useSwapQuoteRequestParams } from '../../hooks/useSwap';
import { dangerRefs } from '../../refs';
import { SwapError } from '../../typings';

const RefreshButtonImpl = () => {
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
    <Pressable onPress={onRefresh} isDisabled={loading}>
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
    </Pressable>
  );
};

const RefreshButton = () => {
  const error = useAppSelector((s) => s.swap.error);
  return (
    <Box position="relative">
      <RefreshButtonImpl />
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
  );
};

export default RefreshButton;
