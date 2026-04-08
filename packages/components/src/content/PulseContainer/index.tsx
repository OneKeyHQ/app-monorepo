import type { ReactNode } from 'react';
import { memo, useEffect, useMemo, useRef } from 'react';

import { Animated, Easing } from 'react-native';

export interface IPulseContainerProps {
  children: ReactNode;
  isActive?: boolean;
  duration?: number;
  activeOpacity?: number;
}

function BasicPulseContainer({
  children,
  isActive = false,
  duration = 600,
  activeOpacity = 0.6,
}: IPulseContainerProps) {
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: isActive ? activeOpacity : 1,
      useNativeDriver: true,
      duration,
      easing: Easing.inOut(Easing.ease),
    }).start();
  }, [isActive, activeOpacity, duration, opacityAnim]);

  const animatedStyle = useMemo(
    () => ({ opacity: opacityAnim }),
    [opacityAnim],
  );

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

export const PulseContainer = memo(BasicPulseContainer);
