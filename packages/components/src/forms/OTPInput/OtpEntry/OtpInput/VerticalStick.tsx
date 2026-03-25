import * as React from 'react';
import { memo, useEffect, useMemo, useRef } from 'react';

import { Animated, View } from 'react-native';

import { styles } from './OtpInput.styles';

import type { ColorValue, ViewStyle } from 'react-native';

interface IVerticalStickProps {
  focusColor?: ColorValue;
  style?: ViewStyle;
  focusStickBlinkingDuration?: number;
}
function BasicVerticalStick({
  focusColor,
  style,
  focusStickBlinkingDuration = 350,
}: IVerticalStickProps) {
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0,
          useNativeDriver: true,
          duration: focusStickBlinkingDuration,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          useNativeDriver: true,
          duration: focusStickBlinkingDuration,
        }),
      ]),
      {
        iterations: -1,
      },
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [focusStickBlinkingDuration, opacityAnim]);

  const animatedStyle = useMemo(
    () => ({ opacity: opacityAnim }),
    [opacityAnim],
  );

  const stickStyle = useMemo(
    () => [
      styles.stick,
      focusColor ? { backgroundColor: focusColor } : {},
      style,
    ],
    [focusColor, style],
  );

  return (
    <Animated.View style={animatedStyle}>
      <View style={stickStyle} testID="otp-input-stick" />
    </Animated.View>
  );
}

export const VerticalStick = memo(BasicVerticalStick);
