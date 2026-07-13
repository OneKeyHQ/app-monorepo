import { memo, useEffect } from 'react';

import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useMedia, useTheme } from '@onekeyhq/components';

import type { ViewStyle } from 'react-native';

const BLEND_TEAL = '#2CD6A0';

const TEAL_ORB = {
  size: 280,
  top: 50,
  left: -120,
  peakAlpha: 0.13,
  gradientEdgePct: 65,
  xKeyframes: [0, -30, 25, 0],
  yKeyframes: [0, 40, 25, 0],
  scaleKeyframes: [1, 1.06, 0.96, 1],
  durationMs: 20_000,
} as const;

const BRAND_ORB = {
  size: 380,
  bottom: 220,
  right: -100,
  peakAlpha: 0.08,
  gradientEdgePct: 70,
  xKeyframes: [0, 85, 35, 0],
  yKeyframes: [0, -65, 85, 0],
  scaleKeyframes: [1, 1.15, 0.88, 1],
  durationMs: 25_000,
} as const;

type IOrbProps = {
  size: number;
  top?: number | `${number}%`;
  bottom?: number;
  left?: number | `${number}%`;
  right?: number;
  color: string;
  peakAlpha: number;
  gradientEdgePct: number;
  xKeyframes: readonly number[];
  yKeyframes: readonly number[];
  scaleKeyframes: readonly number[];
  opacityKeyframes?: readonly number[];
  durationMs: number;
};

const Orb = memo(
  ({
    size,
    top,
    bottom,
    left,
    right,
    color,
    peakAlpha,
    gradientEdgePct,
    xKeyframes,
    yKeyframes,
    scaleKeyframes,
    opacityKeyframes,
    durationMs,
  }: IOrbProps) => {
    const x = useSharedValue(xKeyframes[0]);
    const y = useSharedValue(yKeyframes[0]);
    const scale = useSharedValue(scaleKeyframes[0]);
    const opacity = useSharedValue(opacityKeyframes?.[0] ?? 1);

    useEffect(() => {
      const segments = xKeyframes.length - 1;
      const segDur = durationMs / segments;
      const easing = Easing.inOut(Easing.ease);

      const seq = (vals: readonly number[]) =>
        withRepeat(
          withSequence(
            ...vals
              .slice(1)
              .map((v) => withTiming(v, { duration: segDur, easing })),
          ),
          -1,
          false,
        );

      x.value = seq(xKeyframes);
      y.value = seq(yKeyframes);
      scale.value = seq(scaleKeyframes);
      if (opacityKeyframes) {
        opacity.value = seq(opacityKeyframes);
      }
      return () => {
        cancelAnimation(x);
        cancelAnimation(y);
        cancelAnimation(scale);
        cancelAnimation(opacity);
      };
    }, [
      durationMs,
      opacity,
      opacityKeyframes,
      scale,
      scaleKeyframes,
      x,
      xKeyframes,
      y,
      yKeyframes,
    ]);

    const animStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: x.value },
        { translateY: y.value },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    }));

    const gradientId = `hero-orb-${size}-${color.replace('#', '')}`;

    return (
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            top,
            bottom,
            left,
            right,
          } as ViewStyle,
          animStyle,
        ]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient
              id={gradientId}
              cx="50%"
              cy="50%"
              rx="50%"
              ry="50%"
              fx="50%"
              fy="50%"
            >
              <Stop offset="0%" stopColor={color} stopOpacity={peakAlpha} />
              <Stop
                offset={`${gradientEdgePct}%`}
                stopColor={color}
                stopOpacity={0}
              />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
      </Animated.View>
    );
  },
);
Orb.displayName = 'Orb';

// Based on `BgOrbDrift` from the Onboarding Background Explorations design
// handoff (`docs/plans/2026-04-27-onboarding-hero-atmosphere.md`).
export function HeroAtmosphere() {
  const theme = useTheme();
  const { gtMd } = useMedia();
  const accent = theme.brand9.val;

  // Orb sizes/positions are tuned for narrow viewports (mobile). On wide
  // breakpoints the same numbers look like small spots in the corners, so
  // we hide the atmosphere entirely there.
  if (gtMd) {
    return null;
  }

  return (
    <>
      <Orb {...TEAL_ORB} color={BLEND_TEAL} />
      <Orb {...BRAND_ORB} color={accent} />
    </>
  );
}
