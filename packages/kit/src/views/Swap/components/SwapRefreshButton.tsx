import { memo, useCallback, useEffect, useRef } from 'react';

import { Animated } from 'react-native';

import { LottieView, XStack } from '@onekeyhq/components';
import { swapRefreshInterval } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { useSwapActionState } from '../hooks/useSwapState';

const SwapRefreshButton = ({
  refreshAction,
}: {
  refreshAction: (manual?: boolean) => void;
}) => {
  const loadingAnim = useRef(new Animated.Value(0)).current;
  const processAnim = useRef(new Animated.Value(0)).current;
  const processAnimRef = useRef<Animated.CompositeAnimation>();
  const themeVariant = useThemeVariant();
  const lottieRef = useRef<any>(null);
  const isFocused = useRouteIsFocused();
  const { isRefreshQuote } = useSwapActionState();
  const isRefreshQuoteRef = useRef(isRefreshQuote);
  if (isRefreshQuoteRef.current !== isRefreshQuote) {
    isRefreshQuoteRef.current = isRefreshQuote;
  }
  const onRefresh = useCallback(
    (manual?: boolean) => {
      if (!isFocused) return;
      loadingAnim.setValue(0);
      Animated.timing(loadingAnim, {
        toValue: -1,
        duration: 500,
        useNativeDriver: true,
      }).start((finished) => {
        if (finished) {
          refreshAction(manual);
        }
      });
    },
    [isFocused, loadingAnim, refreshAction],
  );

  useEffect(() => {
    const fn = processAnim.addListener(({ value }) => {
      if (value === swapRefreshInterval) {
        onRefresh();
      }
    });
    return () => processAnim.removeListener(fn);
  }, [onRefresh, processAnim]);

  useEffect(() => {
    if (!isRefreshQuoteRef.current) {
      processAnimRef.current = Animated.timing(processAnim, {
        toValue: swapRefreshInterval,
        duration: swapRefreshInterval,
        useNativeDriver: true,
      });
      processAnimRef.current?.reset();
      processAnimRef.current?.start();
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      lottieRef.current?.reset();
      processAnimRef.current?.reset();
    }
  }, [processAnim, isRefreshQuote]);

  useEffect(() => {
    if (isFocused) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const value = Number((processAnim as any)._value);
      if (value === swapRefreshInterval) {
        onRefresh();
      }
    }
  }, [isFocused, processAnim, onRefresh]);

  return (
    <XStack
      cursor="pointer"
      onPress={(event) => {
        event.stopPropagation();
        onRefresh(true);
      }}
    >
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
        <LottieView
          ref={lottieRef}
          source={
            themeVariant === 'light'
              ? require('@onekeyhq/kit/assets/animations/lottie_onekey_swap_refresh_light.json')
              : require('@onekeyhq/kit/assets/animations/lottie_onekey_swap_refresh_dark.json')
          }
          width={20}
          height={20}
          autoPlay
        />
      </Animated.View>
    </XStack>
  );
};

export default memo(SwapRefreshButton);
