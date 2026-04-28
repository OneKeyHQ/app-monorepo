import { useEffect } from 'react';

import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@onekeyhq/components';

type IOrbProps = {
  size: number;
  top?: number | `${number}%`;
  bottom?: number;
  left?: number | `${number}%`;
  right?: number;
  color: string;
  peakAlpha: number;
  gradientEdgePct: number;
  xKeyframes: number[];
  yKeyframes: number[];
  scaleKeyframes: number[];
  opacityKeyframes?: number[];
  durationMs: number;
};

function Orb({
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
}: IOrbProps) {
  const x = useSharedValue(xKeyframes[0]);
  const y = useSharedValue(yKeyframes[0]);
  const scale = useSharedValue(scaleKeyframes[0]);
  const opacity = useSharedValue(opacityKeyframes?.[0] ?? 1);

  // Empty deps: animations are set up once on mount. Including the
  // `*Keyframes` array props in deps would re-run on every render (parent
  // passes new array literals each time) and reset the animation before it
  // ever completes a cycle.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const segments = xKeyframes.length - 1;
    const segDur = durationMs / segments;
    const easing = Easing.inOut(Easing.ease);

    const seq = (vals: number[]) =>
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
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

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
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          top,
          bottom,
          left,
          right,
        } as never,
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
}

// Two large blurred orbs slowly drifting across the page — based on
// `BgOrbDrift` from the Onboarding Background Explorations design handoff.
// `wordIndex` is kept as an optional forward-compat prop in case future
// iterations want to couple per-word visual response.
const BLEND_TEAL = '#2CD6A0';

export function HeroAtmosphere(_props: { wordIndex?: number }) {
  const theme = useTheme();
  const accent = theme.brand9?.val ?? '#32B826';

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
      }}
    >
      <Orb
        size={280}
        top={50}
        right={-160}
        color={BLEND_TEAL}
        peakAlpha={0.13}
        gradientEdgePct={65}
        xKeyframes={[0, -30, 25, 0]}
        yKeyframes={[0, 40, 25, 0]}
        scaleKeyframes={[1, 1.06, 0.96, 1]}
        durationMs={20_000}
      />
      <Orb
        size={380}
        bottom={100}
        left={-200}
        color={accent}
        peakAlpha={0.06}
        gradientEdgePct={70}
        xKeyframes={[0, 85, 35, 0]}
        yKeyframes={[0, -65, 85, 0]}
        scaleKeyframes={[1, 1.15, 0.88, 1]}
        durationMs={25_000}
      />
    </Animated.View>
  );
}
