import { memo, useEffect } from 'react';
import type { ComponentProps } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  G,
  Path,
  Text as SvgText,
  TSpan,
  TextPath,
} from 'react-native-svg';

import { LinearGradient, YStack } from '@onekeyhq/components';

import { BG_SHEEN, SETUP_CARD_SHADOW } from './SetupCard';

// The OneKey SeedCard product illustration (Figma "Stack", inside node
// 24886:7911), drawn fully in code. Anatomy, straight off the Figma layers:
//   - Container: 90×90, radius 18, $gray3 base washed by a white sheen along
//     the top-left → bottom-right diagonal (the design's #3F3F3F→#282828
//     fill). Web carries the shared SetupCard shadow recipe; native swaps it
//     for a hairline border.
//   - Engraving: one black-50% vector. The centre monogram's two paths are
//     verbatim from Figma; the ring of micro-text around the edge is the
//     design's 91 outlined glyphs (~88 KB of paths) re-set as live text
//     on a rounded-rectangle ring via TextPath — at ~4 px cap height it reads
//     as engraved texture, not type.
//   - Light sweep: light catching the engraving ONLY — the container never
//     brightens. A white copy of the engraving sits inside a thin diagonal
//     overflow-hidden window that glides across the card; the copy carries
//     the window's exact inverse transform, so it stays pixel-fixed in card
//     space while the window reveals a moving slice of it. (The portable
//     stand-in for an animated SVG mask, which reanimated can't drive
//     cross-platform.) Transform/opacity only, and it sits out reduced
//     motion entirely.

const AnimatedYStack = Animated.createAnimatedComponent(YStack);

const BOX = 90;
const BOX_RADIUS = 18;

// Container fill: $gray3 base + the shared white sheen (BG_SHEEN), here along
// the design's 45° diagonal axis (CheckStepIllustration runs it vertically).
const SHEEN_FROM = { x: 0, y: 0 };
const SHEEN_TO = { x: 1, y: 1 };

const ENGRAVING_TINT = '#000000';
const ENGRAVING_OPACITY = 0.5;
// The engraving vector's offset within the 90×90 box (Figma: 4.72, 4.72).
const ENGRAVING_OFFSET = 4.72;

// The OneKey monogram, verbatim from the Figma vector (coords are
// vector-local; the wrapping <G> applies ENGRAVING_OFFSET).
const MONOGRAM_O =
  'M 40.28 36.978 C 43.962 36.978 46.947 39.958 46.947 43.634 C 46.947 47.31 43.962 50.29 40.28 50.29 C 36.598 50.29 33.614 47.31 33.614 43.634 C 33.614 39.958 36.598 36.978 40.28 36.978 Z M 40.28 40 C 38.27 40 36.64 41.627 36.64 43.634 C 36.64 45.642 38.27 47.269 40.28 47.269 C 42.29 47.269 43.92 45.642 43.92 43.634 C 43.92 41.627 42.29 40 40.28 40 Z';
const MONOGRAM_1 =
  'M 42.179 35.741 L 38.554 35.741 L 38.554 29.22 L 35.307 29.22 L 36.333 26.124 L 42.179 26.124 L 42.179 35.741 Z';

// Micro-text ring: baseline sits 9 px in from the card edge, concentric with
// the edge (radius 18 − 9). Clockwise, so glyphs face outward — upright on
// top, upside-down along the bottom, exactly like the Figma engraving. Length:
// 4×54 straights + 2π×9 corners ≈ 272.5. Text past a path's end is dropped,
// so two seams: runs near the top-left use the bottom-left-seam ring and
// vice versa — no run ever crosses the seam of the ring it sits on.
const RING_SEAM_TOP_LEFT =
  'M 18 9 H 72 A 9 9 0 0 1 81 18 V 72 A 9 9 0 0 1 72 81 H 18 A 9 9 0 0 1 9 72 V 18 A 9 9 0 0 1 18 9';
const RING_SEAM_BOTTOM_LEFT =
  'M 9 72 V 18 A 9 9 0 0 1 18 9 H 72 A 9 9 0 0 1 81 18 V 72 A 9 9 0 0 1 72 81 H 18 A 9 9 0 0 1 9 72';

// Two sizes, measured off the Figma render: the brand run ("OneKey
// SeedCard") is ~1.2× the micro text. System fonts run wider than the
// design's, so the sizes match the runs' LENGTHS (the gaps between runs),
// not their cap height.
const BRAND_TEXT_SIZE = 5;
const MICRO_TEXT_SIZE = 4;
const TEXT_LETTER_SPACING = 0.1;
// Run centres along their ring (startOffset + textAnchor="middle"), measured
// off the Figma render. Each run's text length, offset, and chosen ring are
// co-tuned — if an engraving string ever changes, re-measure so the run still
// clears its ring's seam.
const RUN_TOP = 27; // "OneKey SeedCard", centred on the top edge
const RUN_RIGHT = 89.6; // down the right edge
const RUN_BOTTOM = 176; // along the bottom, wrapping the bottom-left corner
const RUN_LEFT = 46.5; // up the left edge (bottom-left-seam ring)

// Light sweep: one linear cycle; the window finishes its diagonal pass at
// SWEEP_END and the rest of the cycle is a resting beat. The whole window
// also rides an opacity bell so the light eases in and out of the pass
// instead of popping at the card's corners.
const CYCLE_MS = 3600;
const SWEEP_END = 0.55;
const WINDOW_WIDTH = 30;
const WINDOW_LENGTH = BOX * 2; // covers the box at 45°
// Window centre travel, projected on each axis: clear the far corners plus
// the window's own width on both sides of the 90√2 diagonal.
const WINDOW_TRAVEL = Math.ceil(
  ((BOX * Math.SQRT2) / 2 + WINDOW_WIDTH) / Math.SQRT2,
);
// The window's offset from the card origin (it's centred on the card).
const WINDOW_LEFT = (BOX - WINDOW_WIDTH) / 2;
const WINDOW_TOP = (BOX - WINDOW_LENGTH) / 2;

// One engraved text run: centred at `startOffset` along its ring.
function RingRun({
  tint,
  href,
  startOffset,
  fontSize,
  children,
}: {
  tint: string;
  href: string;
  startOffset: number;
  fontSize: number;
  // TextPath accepts its own TextChild tree, narrower than ReactNode.
  children: ComponentProps<typeof TextPath>['children'];
}) {
  return (
    <SvgText
      fill={tint}
      fillOpacity={ENGRAVING_OPACITY}
      fontSize={fontSize}
      letterSpacing={TEXT_LETTER_SPACING}
      textAnchor="middle"
    >
      <TextPath href={href} startOffset={startOffset}>
        {children}
      </TextPath>
    </SvgText>
  );
}

// The full engraving (monogram + micro-text ring), in `tint`. Rendered twice —
// dark base and white glow copy — so the ids carry a suffix: on web, <Defs>
// ids are looked up document-wide and duplicates would shadow each other.
function Engraving({ tint, idSuffix }: { tint: string; idSuffix: string }) {
  const ringTopLeftSeam = `seed-card-ring-tl-${idSuffix}`;
  const ringBottomLeftSeam = `seed-card-ring-bl-${idSuffix}`;
  return (
    <Svg width={BOX} height={BOX} viewBox={`0 0 ${BOX} ${BOX}`} fill="none">
      <Defs>
        <Path id={ringTopLeftSeam} d={RING_SEAM_TOP_LEFT} />
        <Path id={ringBottomLeftSeam} d={RING_SEAM_BOTTOM_LEFT} />
      </Defs>
      <G x={ENGRAVING_OFFSET} y={ENGRAVING_OFFSET}>
        <Path
          d={MONOGRAM_O}
          fillRule="evenodd"
          fill={tint}
          fillOpacity={ENGRAVING_OPACITY}
        />
        <Path d={MONOGRAM_1} fill={tint} fillOpacity={ENGRAVING_OPACITY} />
      </G>
      <RingRun
        tint={tint}
        href={`#${ringTopLeftSeam}`}
        startOffset={RUN_TOP}
        fontSize={BRAND_TEXT_SIZE}
      >
        <TSpan fontWeight="bold">OneKey</TSpan>
        {/* NBSP: a plain leading space would be collapsed by the XML
            whitespace rules on web. */}
        <TSpan>{'\u00A0SeedCard'}</TSpan>
      </RingRun>
      <RingRun
        tint={tint}
        href={`#${ringTopLeftSeam}`}
        startOffset={RUN_RIGHT}
        fontSize={MICRO_TEXT_SIZE}
      >
        Recovery Phrase Backup Card
      </RingRun>
      <RingRun
        tint={tint}
        href={`#${ringTopLeftSeam}`}
        startOffset={RUN_BOTTOM}
        fontSize={MICRO_TEXT_SIZE}
      >
        Designed by OneKey in Hong Kong SAR & Tokyo
      </RingRun>
      <RingRun
        tint={tint}
        href={`#${ringBottomLeftSeam}`}
        startOffset={RUN_LEFT}
        fontSize={MICRO_TEXT_SIZE}
      >
        Water resistance
      </RingRun>
    </Svg>
  );
}

// Drives the shared sweep cycle. `windowStyle` slides the clipping window
// diagonally (with an opacity bell over the pass); `contentStyle` is its
// exact inverse — CSS transform lists compose left-to-right and both views
// share the same centre point, so rotate(45)·shift on the window and
// rotate(−45)·(−shift) on the content cancel, pinning the white engraving
// to card space while the window moves over it.
function useLightSweep() {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(progress);
      progress.value = 0;
      return undefined;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);
  // Diagonal travel of the window centre — derived once so the window and its
  // inverse read the SAME value each frame and can never drift apart.
  const shift = useDerivedValue(() =>
    interpolate(
      progress.value,
      [0, SWEEP_END],
      [-WINDOW_TRAVEL, WINDOW_TRAVEL],
      Extrapolation.CLAMP,
    ),
  );
  const windowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, SWEEP_END * 0.25, SWEEP_END * 0.75, SWEEP_END],
      [0, 1, 1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      { translateX: shift.value },
      { translateY: shift.value },
      { rotate: '45deg' },
    ],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: '-45deg' },
      { translateX: -shift.value },
      { translateY: -shift.value },
    ],
  }));
  return { windowStyle, contentStyle, reduceMotion };
}

// Memoized: a no-prop leaf, so parent re-renders never rebuild the SVG tree.
export const SeedCardIllustration = memo(function SeedCardIllustration() {
  const { windowStyle, contentStyle, reduceMotion } = useLightSweep();
  return (
    <YStack
      w={BOX}
      h={BOX}
      borderRadius={BOX_RADIUS}
      borderCurve="continuous"
      overflow="hidden"
      bg="$gray3"
      pointerEvents="none"
      $platform-web={{ boxShadow: SETUP_CARD_SHADOW }}
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$neutral3',
      }}
    >
      <LinearGradient
        colors={BG_SHEEN}
        start={SHEEN_FROM}
        end={SHEEN_TO}
        style={StyleSheet.absoluteFill}
      />
      {/* Every layer is absolute so web stacking follows source order —
          positioned siblings would otherwise paint over in-flow content. */}
      <YStack position="absolute" top={0} left={0}>
        <Engraving tint={ENGRAVING_TINT} idSuffix="base" />
      </YStack>
      {reduceMotion ? null : (
        <AnimatedYStack
          position="absolute"
          left={WINDOW_LEFT}
          top={WINDOW_TOP}
          w={WINDOW_WIDTH}
          h={WINDOW_LENGTH}
          overflow="hidden"
          style={windowStyle}
        >
          {/* Counter-transformed so the engraving stays put in card space;
              offset back to the card origin (window frame → card frame). */}
          <AnimatedYStack
            position="absolute"
            left={-WINDOW_LEFT}
            top={-WINDOW_TOP}
            w={BOX}
            h={BOX}
            style={contentStyle}
          >
            <Engraving tint="#FFFFFF" idSuffix="glow" />
          </AnimatedYStack>
        </AnimatedYStack>
      )}
    </YStack>
  );
});
