import { memo, useCallback, useEffect, useRef } from 'react';

import { debounce } from 'lodash';
import { Animated } from 'react-native';

import { LottieView, XStack } from '@onekeyhq/components';
import { swapRefreshInterval } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { useSwapActionState } from '../hooks/useSwapState';

type ISwapRefreshButtonBaseProps = {
  refreshAction: (manual?: boolean) => void;
  disabled?: boolean;
  isRefreshQuote: boolean;
  isLoading: boolean;
  isFocused?: boolean;
  autoRefresh?: boolean;
};

function BasicSwapRefreshButton({
  refreshAction,
  disabled,
  isRefreshQuote,
  isLoading,
  isFocused = true,
  autoRefresh = true,
}: ISwapRefreshButtonBaseProps) {
  const loadingAnim = useRef(new Animated.Value(0)).current;
  const processAnim = useRef(new Animated.Value(0)).current;
  const processAnimRef = useRef<Animated.CompositeAnimation>(undefined);
  const themeVariant = useThemeVariant();
  const lottieRef = useRef<any>(null);
  const isRefreshQuoteRef = useRef(isRefreshQuote);
  if (isRefreshQuoteRef.current !== isRefreshQuote) {
    isRefreshQuoteRef.current = isRefreshQuote;
  }
  const disabledRef = useRef(disabled);
  if (disabledRef.current !== disabled) {
    disabledRef.current = disabled;
  }
  const refreshLockedRef = useRef(false);
  const listenerRef = useRef<string | null>(null);
  const isFocusedRef = useRef(isFocused);
  if (isFocusedRef.current !== isFocused) {
    isFocusedRef.current = isFocused;
  }
  const loadingAnimRef = useRef(loadingAnim);
  if (loadingAnimRef.current !== loadingAnim) {
    loadingAnimRef.current = loadingAnim;
  }
  const refreshActionRef = useRef(refreshAction);
  if (refreshActionRef.current !== refreshAction) {
    refreshActionRef.current = refreshAction;
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onRefresh = useCallback(
    debounce((manual?: boolean) => {
      if (
        !isFocusedRef.current ||
        disabledRef.current ||
        isRefreshQuoteRef.current ||
        refreshLockedRef.current
      ) {
        return;
      }
      refreshLockedRef.current = true;
      loadingAnimRef.current.setValue(0);
      Animated.timing(loadingAnimRef.current, {
        toValue: -1,
        duration: 500,
        useNativeDriver: true,
      }).start((finished) => {
        if (finished) {
          refreshActionRef.current(manual);
          setTimeout(() => {
            if (!isRefreshQuoteRef.current) {
              refreshLockedRef.current = false;
            }
          }, 100);
        } else {
          refreshLockedRef.current = false;
        }
      });
    }, 10),
    [],
  );

  useEffect(() => {
    if (!isRefreshQuote) {
      refreshLockedRef.current = false;
    }
  }, [isRefreshQuote]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    if (listenerRef.current) return;
    listenerRef.current = processAnim.addListener(({ value }) => {
      // mobile will trigger twice, so we need to debounce it , when max value
      if (value === swapRefreshInterval) {
        onRefresh();
      }
    });
    return () => {
      if (listenerRef.current) {
        processAnim.removeListener(listenerRef.current);
        listenerRef.current = null;
      }
    };
  }, [autoRefresh, onRefresh, processAnim]);

  useEffect(() => {
    if (!autoRefresh) {
      processAnimRef.current?.reset();
      return;
    }
    // Don't start auto-refresh timer when disabled
    if (disabled) {
      processAnimRef.current?.reset();
      return;
    }
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
  }, [autoRefresh, processAnim, isRefreshQuote, disabled]);

  useEffect(() => {
    if (isFocusedRef.current) {
      if (isLoading) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        lottieRef.current?.reset();
        processAnimRef.current?.reset();
      }
    }
  }, [isLoading]);

  useEffect(() => {
    if (autoRefresh && isFocused && !disabled) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const value = Number((processAnim as any)._value);
      if (value === swapRefreshInterval) {
        onRefresh();
      }
    }
  }, [autoRefresh, disabled, isFocused, processAnim, onRefresh]);

  // Control Lottie animation when disabled state changes
  useEffect(() => {
    if (disabled) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      lottieRef.current?.reset();
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      lottieRef.current?.play();
    }
  }, [disabled]);

  return (
    <XStack
      cursor={disabled ? 'default' : 'pointer'}
      opacity={disabled ? 0.4 : 1}
      onPress={(event) => {
        if (disabled) return;
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
          width={18}
          height={18}
          autoPlay={!disabled}
        />
      </Animated.View>
    </XStack>
  );
}

export const SwapRefreshButtonBase = memo(BasicSwapRefreshButton);

const SwapRefreshButton = ({
  refreshAction,
  disabled,
}: {
  refreshAction: (manual?: boolean) => void;
  disabled?: boolean;
}) => {
  const isFocused = useRouteIsFocused();
  const { isRefreshQuote, isLoading } = useSwapActionState();
  return (
    <SwapRefreshButtonBase
      refreshAction={refreshAction}
      disabled={disabled}
      isRefreshQuote={!!isRefreshQuote}
      isLoading={!!isLoading}
      isFocused={isFocused}
    />
  );
};

export default memo(SwapRefreshButton);
