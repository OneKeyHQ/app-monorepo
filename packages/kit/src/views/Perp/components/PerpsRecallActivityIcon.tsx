import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';

import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/shared/src/utils/appVisibility';

import {
  PerpsRecallBackTicket,
  PerpsRecallFrontTicket,
  PerpsRecallSparkle,
} from './PerpsRecallIllustration';

const ICON_WIDTH = 24;
const COORDINATE_SCALE = ICON_WIDTH / 148;
const ICON_HEIGHT = 122 * COORDINATE_SCALE;
const styles = StyleSheet.create({
  frame: { width: ICON_WIDTH, height: ICON_HEIGHT },
});

function pulse(phase: number, start: number, end: number) {
  'worklet';

  return phase > start && phase < end
    ? Math.sin(((phase - start) / (end - start)) * Math.PI) ** 2
    : 0;
}

function IllustrationLayer({ children }: { children: ReactNode }) {
  return (
    <Svg width={ICON_WIDTH} height={ICON_HEIGHT} viewBox="0 -2 148 122">
      {children}
    </Svg>
  );
}

export function PerpsRecallActivityIcon() {
  const isFocused = useIsFocused();
  const reducedMotion = useReducedMotion();
  const phase = useSharedValue(0);

  useEffect(() => {
    const updateAnimation = (visible: boolean) => {
      cancelAnimation(phase);
      phase.value = 0;
      if (!visible || !isFocused || reducedMotion) return;

      // Animate for half of the 3.8s cycle, then hold the resting pose.
      phase.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 1900, easing: Easing.linear }),
          withDelay(1900, withTiming(0, { duration: 0 })),
        ),
        -1,
      );
    };
    updateAnimation(getCurrentVisibilityState());
    const unsubscribe = onVisibilityStateChange(updateAnimation);
    return () => {
      unsubscribe();
      cancelAnimation(phase);
    };
  }, [isFocused, phase, reducedMotion]);

  // Stagger the tickets around their own pivots to emphasize their separation.
  const backStyle = useAnimatedStyle(() => {
    const amount = pulse(phase.value, 0.02, 0.36);
    return {
      transform: [
        { translateX: (-7 - amount * 3) * COORDINATE_SCALE },
        { translateY: (-9 - amount * 5) * COORDINATE_SCALE },
        { rotate: `${-amount * 8}deg` },
        { translateX: 7 * COORDINATE_SCALE },
        { translateY: 9 * COORDINATE_SCALE },
      ],
    };
  });
  const frontStyle = useAnimatedStyle(() => {
    const amount = pulse(phase.value, 0.12, 0.46);
    return {
      transform: [
        { translateX: (4 + amount * 2) * COORDINATE_SCALE },
        { translateY: (21 - amount * 3) * COORDINATE_SCALE },
        { rotate: `${amount * 5}deg` },
        { translateX: -4 * COORDINATE_SCALE },
        { translateY: -21 * COORDINATE_SCALE },
      ],
    };
  });
  const largeSparkleStyle = useAnimatedStyle(() => {
    const amount = pulse(phase.value, 0.14, 0.5);
    return {
      opacity: 0.9 + amount * 0.1,
      transform: [
        { translateX: 58 * COORDINATE_SCALE },
        { translateY: -20 * COORDINATE_SCALE },
        { scale: 1.4 + amount * 0.2 },
        { translateX: -58 * COORDINATE_SCALE },
        { translateY: 20 * COORDINATE_SCALE },
      ],
    };
  });
  const smallSparkleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -59 * COORDINATE_SCALE },
      { translateY: 30 * COORDINATE_SCALE },
      { scale: 1.7 + pulse(phase.value, 0.02, 0.36) * 0.2 },
      { translateX: 59 * COORDINATE_SCALE },
      { translateY: -30 * COORDINATE_SCALE },
    ],
  }));

  return (
    <Animated.View
      testID="perps-recall-activity-icon"
      style={styles.frame}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[StyleSheet.absoluteFill, backStyle]}>
        <IllustrationLayer>
          <PerpsRecallBackTicket strokeWidth={5} />
        </IllustrationLayer>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, frontStyle]}>
        <IllustrationLayer>
          <PerpsRecallFrontTicket strokeWidth={5} simplified />
        </IllustrationLayer>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, largeSparkleStyle]}>
        <IllustrationLayer>
          <PerpsRecallSparkle />
        </IllustrationLayer>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, smallSparkleStyle]}>
        <IllustrationLayer>
          <PerpsRecallSparkle small />
        </IllustrationLayer>
      </Animated.View>
    </Animated.View>
  );
}
