import { memo, useEffect, useMemo, useState } from 'react';

import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { YStack } from '@onekeyhq/components';

// A one-shot celebratory confetti blast. This is a faithful reanimated-DOM port
// of react-native-fast-confetti's PIConfetti motion model (golden-angle disc
// blast → fall → flutter → fade). We re-implement it instead of using the
// library because the library drives Skia from reanimated, which has a known
// bug where it does not repaint on web production builds (the canvas freezes on
// the first frame). reanimated → DOM has no such issue and runs on every
// OneKey platform.
//
// Rendered via OnboardingPage's `foregroundLayer` (a full-page, top-anchored
// overlay), so flakes are positioned by percentage of the page and stay centred
// regardless of the page's narrow/animated content container.
//
// The values below mirror the reference demo's props 1:1.
const COLORS = ['#a864fd', '#29cdff', '#78ff44', '#ff718d', '#fdff6a'];
const COUNT = 200;
const BLAST_RADIUS = 200;
const BLAST_DURATION = 150;
const FALL_DURATION = 1200;
// Base fall distance. The reference resolves this to blastRadius (200); we pull
// it in so the confetti settles closer to the burst instead of drifting far
// down the page.
const FALL_DISTANCE = 110;
const FLAKE_W = 10;
const FLAKE_H = 6;
const SIZE_VARIATION = 0.9;
// PIConfetti jiggle: stops are [0, 0.1, then 6 evenly-spaced points up to 1].
const JIGGLE_STOPS = [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1];
// Blast origin as a fraction of the full page: horizontal centre, upper area
// (over the content). Tweak ANCHOR_TOP to move the burst up/down.
const ANCHOR_LEFT = '50%' as const;
const ANCHOR_TOP = '20%' as const;

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

type IFlakeConfig = {
  blastTargetX: number;
  blastTargetY: number;
  width: number;
  height: number;
  color: string;
  rotDir: number;
  maxRotationZ: number;
  maxRotationX: number;
  initialRotation: number;
  randomOffsetX: number;
  randomOffsetY: number;
  delayBlast: number;
  jiggleValues: number[];
};

function buildFlakes(): IFlakeConfig[] {
  return Array.from({ length: COUNT }).map((_, index): IFlakeConfig => {
    // Deterministic golden-angle spiral fills the blast disc evenly (PIConfetti
    // uses radius = sqrt((i+1)/count) * blastRadius, angle = i * 137.5°).
    const radius = Math.sqrt((index + 1) / COUNT) * BLAST_RADIUS;
    const angle = (((index * 137.5) % 360) * Math.PI) / 180;
    // Quadratic-skewed size variation, matching useVariations().
    const widthScale = -(Math.random() ** 2);
    const heightScale = -(Math.random() ** 2);
    return {
      blastTargetX: Math.cos(angle) * radius,
      blastTargetY: Math.sin(angle) * radius,
      width: FLAKE_W * (1 + SIZE_VARIATION * widthScale),
      height: FLAKE_H * (1 + SIZE_VARIATION * heightScale),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotDir: Math.random() >= 0.5 ? 1 : -1,
      maxRotationZ: rand(Math.PI, 3 * Math.PI),
      maxRotationX: rand(Math.PI, 3 * Math.PI),
      initialRotation: rand(0.1 * Math.PI, Math.PI),
      randomOffsetX: rand(-50, 50),
      randomOffsetY: rand(0, 70),
      delayBlast: rand(0, 0.6),
      jiggleValues: [0, 0, ...Array.from({ length: 6 }, () => rand(-5, 5))],
    };
  });
}

const ConfettiFlake = memo(function ConfettiFlake({
  config,
  blast,
  fall,
}: {
  config: IFlakeConfig;
  blast: ReturnType<typeof useSharedValue<number>>;
  fall: ReturnType<typeof useSharedValue<number>>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const b = blast.value;
    const f = fall.value;
    // Per-piece blast can start late (delayBlast), unclamped like PIConfetti's
    // Extrapolation.IDENTITY.
    const delayedBlast = (b - config.delayBlast) / (1 - config.delayBlast);
    const jiggle = interpolate(f, JIGGLE_STOPS, config.jiggleValues);
    const translateX =
      config.blastTargetX * delayedBlast + config.randomOffsetX * f + jiggle;
    const translateY =
      config.blastTargetY * delayedBlast +
      FALL_DISTANCE * f +
      config.randomOffsetY * f;
    const rotateZ =
      config.initialRotation + config.rotDir * config.maxRotationZ * f;
    const rotateX =
      config.initialRotation + config.rotDir * config.maxRotationX * f;
    // |cos(rotateX)| fakes the 3D flip by oscillating the uniform scale, exactly
    // as PIConfetti does in its transform buffer.
    const oscillatingScale = Math.abs(Math.cos(rotateX));
    const blastScale = interpolate(b, [0, 0.2, 1], [0, 1, 1]);
    return {
      opacity: interpolate(f, [0, 1], [1, 0]),
      transform: [
        { translateX },
        { translateY },
        { rotateZ: `${rotateZ}rad` },
        { scale: blastScale * oscillatingScale },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: ANCHOR_LEFT,
          top: ANCHOR_TOP,
          width: config.width,
          height: config.height,
          backgroundColor: config.color,
        },
        animatedStyle,
      ]}
    />
  );
});

function ConfettiOverlay() {
  const blast = useSharedValue(0);
  const fall = useSharedValue(0);
  const [visible, setVisible] = useState(true);

  const flakes = useMemo(() => buildFlakes(), []);

  useEffect(() => {
    // Blast and fall both start now (same as PIConfetti.restart()); default
    // reanimated easing is Easing.inOut(quad), matching the library.
    blast.value = withTiming(1, { duration: BLAST_DURATION });
    fall.value = withTiming(1, { duration: FALL_DURATION });
    const timer = setTimeout(() => setVisible(false), FALL_DURATION + 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) {
    return null;
  }

  // Fills the foregroundLayer (= the full page) so percentage-anchored flakes
  // resolve against the page, not the narrow content box.
  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      pointerEvents="none"
    >
      {flakes.map((config, index) => (
        <ConfettiFlake
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          config={config}
          blast={blast}
          fall={fall}
        />
      ))}
    </YStack>
  );
}

export const Confetti = memo(ConfettiOverlay);

export default Confetti;
