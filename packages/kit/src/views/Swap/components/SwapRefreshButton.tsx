import { memo, useCallback, useEffect, useRef } from 'react';

import { debounce } from 'lodash';
import { Animated } from 'react-native';

import { LottieView, XStack } from '@onekeyhq/components';

import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import {
  useSwapQuoteAutoRefreshTimerAtom,
  useSwapShouldRefreshQuoteAtom,
} from '../../../states/jotai/contexts/swap';
import { shouldPlaySwapQuoteRefreshAnimation } from '../../../states/jotai/contexts/swap/quoteProgress';
import { useSwapActionState } from '../hooks/useSwapState';

type ISwapRefreshButtonBaseProps = {
  refreshAction: () => void;
  disabled?: boolean;
  isRefreshQuote: boolean;
  isLoading: boolean;
  isFocused?: boolean;
  manualRefreshRequired?: boolean;
  autoRefreshTimerActive?: boolean;
};

function BasicSwapRefreshButton({
  refreshAction,
  disabled,
  isRefreshQuote,
  isLoading,
  isFocused = true,
  manualRefreshRequired = false,
  autoRefreshTimerActive = false,
}: ISwapRefreshButtonBaseProps) {
  const loadingAnim = useRef(new Animated.Value(0)).current;
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
  const shouldPlayAutoRefreshAnimation = shouldPlaySwapQuoteRefreshAnimation({
    autoRefreshTimerActive,
    disabled: Boolean(disabled),
    focused: isFocused,
    loading: isLoading,
    manualRefreshRequired,
    refreshActionRequired: isRefreshQuote,
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onRefresh = useCallback(
    debounce(() => {
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
          refreshActionRef.current();
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

  // Auto-refresh is owned by the quote action. The icon only runs while that
  // owner has a real refresh timer scheduled for the current context.
  useEffect(() => {
    if (!shouldPlayAutoRefreshAnimation) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      lottieRef.current?.reset();
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      lottieRef.current?.play();
    }
  }, [shouldPlayAutoRefreshAnimation]);

  return (
    <XStack
      cursor={disabled ? 'default' : 'pointer'}
      opacity={disabled ? 0.4 : 1}
      onPress={(event) => {
        if (disabled) return;
        event.stopPropagation();
        onRefresh();
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
          autoPlay={shouldPlayAutoRefreshAnimation}
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
  refreshAction: () => void;
  disabled?: boolean;
}) => {
  const isFocused = useRouteIsFocused();
  const { isRefreshQuote, isLoading } = useSwapActionState();
  const [manualRefreshRequired] = useSwapShouldRefreshQuoteAtom();
  const [autoRefreshTimer] = useSwapQuoteAutoRefreshTimerAtom();
  return (
    <SwapRefreshButtonBase
      refreshAction={refreshAction}
      disabled={disabled}
      isRefreshQuote={!!isRefreshQuote}
      isLoading={!!isLoading}
      isFocused={isFocused}
      manualRefreshRequired={manualRefreshRequired}
      autoRefreshTimerActive={autoRefreshTimer !== undefined}
    />
  );
};

export default memo(SwapRefreshButton);
