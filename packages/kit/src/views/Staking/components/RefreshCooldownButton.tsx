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
  const isFirstRender = useRef(true);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Cooldown after quote fetched
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (triggerCooldown === 0) return;

    setIsCoolingDown(true);
    const timer = setTimeout(() => setIsCoolingDown(false), cooldownMs);
    return () => clearTimeout(timer);
  }, [triggerCooldown, cooldownMs]);

  // Animate while loading
  useEffect(() => {
    if (loading) {
      rotateAnim.setValue(0);
      const loop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => {
        loop.stop();
        rotateAnim.setValue(0);
      };
    }
  }, [loading, rotateAnim]);

  const isDisabled = isCoolingDown || !!loading;

  const handlePress = useCallback(() => {
    if (isDisabled) return;
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
