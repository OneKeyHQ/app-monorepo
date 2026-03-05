import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { Animated, Easing } from 'react-native';

import { Icon, Stack } from '@onekeyhq/components';

const DEFAULT_COOLDOWN_MS = 5000;

interface IRefreshCooldownButtonProps {
  onPress: () => void;
  loading?: boolean;
  cooldownMs?: number;
  triggerCooldown?: number;
}

function RefreshCooldownButtonComponent({
  onPress,
  loading,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  triggerCooldown = 0,
}: IRefreshCooldownButtonProps) {
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  const wasLoadingRef = useRef(false);

  // Cooldown after quote fetched
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (triggerCooldown === 0) return;

    setIsCoolingDown(true);
    timerRef.current = setTimeout(() => {
      setIsCoolingDown(false);
    }, cooldownMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [triggerCooldown, cooldownMs]);

  // Stop spinning when loading completes (true → false)
  useEffect(() => {
    if (loading) {
      wasLoadingRef.current = true;
    }
    if (isSpinning && wasLoadingRef.current && !loading) {
      setIsSpinning(false);
    }
  }, [isSpinning, loading]);

  // Drive animation from isSpinning state
  useEffect(() => {
    if (isSpinning) {
      rotateAnim.setValue(0);
      loopRef.current = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
      loopRef.current = null;
      rotateAnim.setValue(0);
    }
  }, [isSpinning, rotateAnim]);

  const isDisabled = isCoolingDown || isSpinning;

  const handlePress = useCallback(() => {
    if (isDisabled) return;
    wasLoadingRef.current = false;
    setIsSpinning(true);
    onPress();
  }, [isDisabled, onPress]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Stack
      hitSlop={8}
      cursor={isDisabled ? 'default' : 'pointer'}
      opacity={isDisabled ? 0.5 : 1}
      onPress={handlePress}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Icon name="RotateClockwiseOutline" size="$5" color="$iconSubdued" />
      </Animated.View>
    </Stack>
  );
}

export const RefreshCooldownButton = memo(RefreshCooldownButtonComponent);
