/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

import { useCallback, useEffect, useRef } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { Animated } from 'react-native';

import { Center, LottieView, useTheme } from '@onekeyhq/components';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import { useAppSelector } from '../../../../hooks';
import { appSelector } from '../../../../store';
import { dangerRefs } from '../../refs';

const RefreshButton = () => {
  const { themeVariant } = useTheme();
  const isFocused = useIsFocused();
  const total = 15000;

  const loadingAnim = useRef(new Animated.Value(0)).current;
  const processAnim = useRef(new Animated.Value(0)).current;
  const loading = useAppSelector((s) => s.swap.loading);

  const onRefresh = useCallback(() => {
    const limited = appSelector((s) => s.swap.quoteLimited);
    if (dangerRefs.submited || limited || !isFocused) {
      return;
    }
    loadingAnim.setValue(0);
    Animated.timing(loadingAnim, {
      toValue: -1,
      duration: 1000,
      useNativeDriver: true,
    }).start(() => {
      appUIEventBus.emit(AppUIEventBusNames.SwapRefresh);
    });
  }, [loadingAnim, isFocused]);

  useEffect(() => {
    const fn = processAnim.addListener(({ value }) => {
      if (value === total) {
        onRefresh();
      }
    });
    return () => processAnim.removeListener(fn);
  }, [onRefresh, processAnim]);

  useEffect(() => {
    Animated.timing(processAnim, {
      toValue: total,
      duration: total,
      useNativeDriver: true,
    }).start();
  }, [processAnim]);

  useEffect(() => {
    if (isFocused) {
      const value = Number((processAnim as any)._value);
      if (value === total) {
        setTimeout(
          () => appUIEventBus.emit(AppUIEventBusNames.SwapRefresh),
          100,
        );
      }
    }
  }, [isFocused, processAnim]);

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
            autoPlay
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

export default RefreshButton;
