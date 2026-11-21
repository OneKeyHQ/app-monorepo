import { useEffect } from 'react';
import type { ReactNode } from 'react';

import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { StyleProp, ViewStyle } from 'react-native';

const FADE = { duration: 200, easing: Easing.out(Easing.cubic) };

// Fades its content to `shown`. What the page opens with just sits there;
// `fadeInOnMount` starts it hidden so it fades in. Reanimated drives it
// directly rather than Tamagui's animation props, which are being retired.
export function FadeView({
  shown = true,
  fadeInOnMount = false,
  style,
  children,
}: {
  shown?: boolean;
  fadeInOnMount?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const target = shown ? 1 : 0;
  const opacity = useSharedValue(fadeInOnMount && !reducedMotion ? 0 : target);
  useEffect(() => {
    opacity.value = reducedMotion ? target : withTiming(target, FADE);
  }, [opacity, reducedMotion, target]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[style, fadeStyle]}>{children}</Animated.View>;
}
