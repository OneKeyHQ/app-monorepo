import { useCallback, useEffect, useRef, useState } from 'react';

import { Pressable } from 'react-native';

import { XStack } from '@onekeyhq/components';
import { MARKET_TOKEN_ROW_GROUP_NAME } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketHoverRevealLine';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { HOME_MARKET_TABLE_ROW_MIN_HEIGHT } from './metricColumns';

import type { IPopularTradingRowContainerProps } from './PopularTradingRowContainer';

const NATIVE_ROW_RELEASE_FALLBACK_MS = 180;

function useNativeRowReleaseTimer() {
  const releaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const clearReleaseTimeout = useCallback(() => {
    if (releaseTimeoutRef.current !== undefined) {
      clearTimeout(releaseTimeoutRef.current);
      releaseTimeoutRef.current = undefined;
    }
  }, []);
  const scheduleReleaseTimeout = useCallback(
    (onExpire: () => void) => {
      clearReleaseTimeout();
      releaseTimeoutRef.current = setTimeout(() => {
        releaseTimeoutRef.current = undefined;
        onExpire();
      }, NATIVE_ROW_RELEASE_FALLBACK_MS);
    },
    [clearReleaseTimeout],
  );
  useEffect(() => () => clearReleaseTimeout(), [clearReleaseTimeout]);
  return { clearReleaseTimeout, scheduleReleaseTimeout };
}

function useNativePressedState(symbol: string) {
  const [nativePressed, setNativePressed] = useState(false);
  const nativePressedRef = useRef(false);
  const { clearReleaseTimeout, scheduleReleaseTimeout } =
    useNativeRowReleaseTimer();

  const handlePressOut = useCallback(() => {
    clearReleaseTimeout();
    if (!nativePressedRef.current) {
      return;
    }
    nativePressedRef.current = false;
    setNativePressed(false);
    defaultLogger.market.navigation.homeTokenNavigation({
      stage: 'pressOut',
      symbol,
    });
  }, [clearReleaseTimeout, symbol]);

  const handlePressIn = useCallback(() => {
    clearReleaseTimeout();
    nativePressedRef.current = true;
    setNativePressed(true);
    defaultLogger.market.navigation.homeTokenNavigation({
      stage: 'pressIn',
      symbol,
    });
  }, [clearReleaseTimeout, symbol]);

  return {
    nativePressed,
    nativePressedRef,
    handlePressIn,
    handlePressOut,
    scheduleReleaseTimeout,
  };
}

function usePopularTradingNativeRowPress({
  symbol,
  onPress,
}: {
  symbol: string;
  onPress: () => void;
}) {
  const {
    nativePressed,
    nativePressedRef,
    handlePressIn,
    handlePressOut,
    scheduleReleaseTimeout,
  } = useNativePressedState(symbol);

  // Pressable cancels its delayed onPressOut timer when a follow-up touch starts.
  const handleTouchStart = useCallback(() => {
    if (nativePressedRef.current) {
      handlePressOut();
    }
  }, [handlePressOut, nativePressedRef]);

  const handleTouchEnd = useCallback(() => {
    if (nativePressedRef.current) {
      scheduleReleaseTimeout(handlePressOut);
    }
  }, [handlePressOut, nativePressedRef, scheduleReleaseTimeout]);

  // Keep nativePressed active through synchronous onPressIn -> onPress on fast taps
  // (< 50ms) so the 130ms press feedback commits, while arming the fallback timer.
  const handlePress = useCallback(() => {
    if (nativePressedRef.current) {
      scheduleReleaseTimeout(handlePressOut);
    }
    onPress();
  }, [handlePressOut, nativePressedRef, onPress, scheduleReleaseTimeout]);

  return {
    nativePressed,
    handlePress,
    handlePressIn,
    handlePressOut,
    handleTouchStart,
    handleTouchEnd,
  };
}

export function PopularTradingRowContainer({
  symbol,
  onPress,
  shouldUseTableLayout,
  children,
}: IPopularTradingRowContainerProps) {
  const {
    nativePressed,
    handlePress,
    handlePressIn,
    handlePressOut,
    handleTouchStart,
    handleTouchEnd,
  } = usePopularTradingNativeRowPress({ symbol, onPress });

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      unstable_pressDelay={50}
    >
      <XStack
        minHeight={HOME_MARKET_TABLE_ROW_MIN_HEIGHT}
        mx="$2"
        px="$3"
        py="$2"
        borderRadius="$3"
        borderCurve="continuous"
        alignItems="center"
        gap={shouldUseTableLayout ? undefined : '$2'}
        bg={nativePressed ? '$bgActive' : '$bgApp'}
        {...(shouldUseTableLayout
          ? { group: MARKET_TOKEN_ROW_GROUP_NAME }
          : undefined)}
      >
        {children}
      </XStack>
    </Pressable>
  );
}
