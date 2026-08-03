import { memo, useEffect } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { G, Path } from 'react-native-svg';

import { LinearGradient, YStack } from '@onekeyhq/components';

import { BG_SHEEN, SETUP_CARD_SHADOW } from './SetupCard';

// The CheckAndUpdate step illustrations (Figma "Illustrations", node
// 24951:25784), drawn fully in code — no more themed PNG assets. Every value
// below is read straight off the Figma layers. Anatomy:
//   - Container: 56×56, radius 12, vertical #3F3F3F→#282828 gradient fill.
//     Web carries the design's layered shadow (identical to the SetupCard
//     recipe, so it's shared); native swaps it for a hairline border.
//   - Border: a 46×46 ring inset 5, radius 8, 1px blackA5. While a check is
//     in progress a "border beam" sweeps around it — the animated version of
//     the design's static diagonal white-gradient stroke.
//   - Glyph: the OneKey monogram (genuine) or cube (firmware), an embossed
//     stack of vectors (base silhouette + dark top "shadow" + light bottom
//     "highlight"); only the base fill changes with state.

const AnimatedYStack = Animated.createAnimatedComponent(YStack);

const BOX = 56;
const BOX_RADIUS = 12;
const RING_INSET = 5;
const RING = BOX - RING_INSET * 2;
const RING_RADIUS = 8;
const RING_STROKE = 1;

// Container fill: $gray3 base with the shared white sheen (BG_SHEEN) washing
// down from the top, rather than two baked greys — so the base stays a token.
const GRADIENT_TOP = { x: 0.5, y: 0 };
const GRADIENT_BOTTOM = { x: 0.5, y: 1 };

// Base glyph fill per state (the embossed overlays never change).
const TONE_FILLS = {
  neutral: { color: '#000000', opacity: 0.5 },
  success: { color: '#37FF35', opacity: 0.85 },
  warning: { color: '#FFE62D', opacity: 0.98 },
  critical: { color: '#FF4E54', opacity: 0.89 },
} as const;

type IGlyphFill = (typeof TONE_FILLS)[keyof typeof TONE_FILLS];

// Beam: a gradient square big enough to cover the ring at any rotation,
// spinning one revolution per BEAM_SWEEP_MS — linear, constant motion. The
// design's static stroke sits at ~134°, so the beam starts there and, under
// reduced motion, simply holds that pose (the Figma stamp, un-animated).
const BEAM_SIZE = Math.ceil(RING * Math.SQRT2);
const BEAM_SWEEP_MS = 2000;
const BEAM_STATIC_DEG = 134;
const BEAM_PEAK = 'rgba(255, 255, 255, 0.5)';
const BEAM_TRANSPARENT = 'rgba(255, 255, 255, 0)';

// Recolor transition: reanimated can't tween an SVG fill (it's resolved in JS
// render), so on tone change the whole glyph stack cross-fades — old and new
// copies are pixel-identical except the base tint, so the overlap reads as a
// pure color transition (same idiom as SetupStepItem's icon recolors). Gentle
// CSS-ease: this is a color change, not an enter/exit.
const TONE_FADE_MS = 180;
const TONE_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);
const TONE_ENTER = FadeIn.duration(TONE_FADE_MS)
  .easing(TONE_EASING)
  .reduceMotion(ReduceMotion.System);
const TONE_EXIT = FadeOut.duration(TONE_FADE_MS)
  .easing(TONE_EASING)
  .reduceMotion(ReduceMotion.System);

// The sweeping light on the in-progress ring. A rotating linear gradient
// clipped to the ring box; the centre is covered by a slice of the container
// gradient (aligned to it, so the cover is invisible) leaving only a
// RING_STROKE-wide rim of beam — two opposing arcs chasing each other.
function BorderBeam() {
  const reduceMotion = useReducedMotion();
  const angle = useSharedValue(BEAM_STATIC_DEG);
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(angle);
      angle.value = BEAM_STATIC_DEG;
      return undefined;
    }
    angle.value = BEAM_STATIC_DEG;
    angle.value = withRepeat(
      withTiming(BEAM_STATIC_DEG + 360, {
        duration: BEAM_SWEEP_MS,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    return () => cancelAnimation(angle);
  }, [angle, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));
  return (
    <YStack
      position="absolute"
      left={RING_INSET}
      top={RING_INSET}
      w={RING}
      h={RING}
      borderRadius={RING_RADIUS}
      borderCurve="continuous"
      overflow="hidden"
      pointerEvents="none"
    >
      <AnimatedYStack
        position="absolute"
        left={(RING - BEAM_SIZE) / 2}
        top={(RING - BEAM_SIZE) / 2}
        w={BEAM_SIZE}
        h={BEAM_SIZE}
        style={style}
      >
        <LinearGradient
          colors={[BEAM_TRANSPARENT, BEAM_PEAK, BEAM_TRANSPARENT]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </AnimatedYStack>
      {/* Cover the beam's interior with a replica of the container fill — the
          $gray3 base plus a slice of the sheen, vertically aligned with the
          container's (the sheen is vertical, so the horizontal crop is
          irrelevant) — leaving only the rim of beam showing. */}
      <YStack
        position="absolute"
        left={RING_STROKE}
        top={RING_STROKE}
        right={RING_STROKE}
        bottom={RING_STROKE}
        borderRadius={RING_RADIUS - RING_STROKE}
        borderCurve="continuous"
        overflow="hidden"
        bg="$gray3"
      >
        <LinearGradient
          colors={BG_SHEEN}
          start={GRADIENT_TOP}
          end={GRADIENT_BOTTOM}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: -(RING_INSET + RING_STROKE),
            height: BOX,
          }}
        />
      </YStack>
    </YStack>
  );
}

// Embossed glyphs, layer-for-layer from Figma (paths exported per layer; each
// <G> carries the layer's offset within the 56×56 container). Only the base
// silhouette is tinted; the dark-top/light-bottom overlays are constant.
function GenuineGlyph({ fill }: { fill: IGlyphFill }) {
  return (
    <Svg width={BOX} height={BOX} viewBox={`0 0 ${BOX} ${BOX}`} fill="none">
      <G x={21.02} y={14.588}>
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M9.62279 0H3.05528L1.9031 3.48398H5.55086V10.8226H9.62279V0ZM14.9799 19.7043C14.9799 23.8409 11.6265 27.1943 7.48994 27.1943C3.35336 27.1943 0 23.8409 0 19.7043C0 15.5677 3.35336 12.2144 7.48994 12.2144C11.6265 12.2144 14.9799 15.5677 14.9799 19.7043ZM7.48992 23.7939C9.74854 23.7939 11.5795 21.9629 11.5795 19.7043C11.5795 17.4457 9.74854 15.6147 7.48992 15.6147C5.23129 15.6147 3.40032 17.4457 3.40032 19.7043C3.40032 21.9629 5.23129 23.7939 7.48992 23.7939Z"
          fill={fill.color}
          fillOpacity={fill.opacity}
        />
      </G>
      <G x={21.021} y={14.59}>
        <Path
          d="M7.48926 12.2148C11.6258 12.2148 14.9794 15.5676 14.9795 19.7041C14.9795 19.8721 14.9709 20.0388 14.96 20.2041C14.7025 16.3008 11.4577 13.2148 7.48926 13.2148C3.52094 13.215 0.275008 16.3009 0.0175781 20.2041C0.00669131 20.0389 0 19.8721 0 19.7041C0.000122538 15.5677 3.35289 12.215 7.48926 12.2148Z"
          fill="#000000"
          fillOpacity={0.9}
        />
        <Path
          d="M9.62207 0V1H3.05469L2.2334 3.48438H1.90234L3.05469 0H9.62207Z"
          fill="#000000"
          fillOpacity={0.9}
        />
      </G>
      <G x={21.021} y={29.203}>
        <Path
          d="M14.96 4.59082C14.9709 4.75615 14.9795 4.92274 14.9795 5.09082C14.9795 9.2274 11.6258 12.5811 7.48926 12.5811C3.35281 12.5809 0 9.22731 0 5.09082C4.97838e-06 4.92277 0.00667652 4.75611 0.0175781 4.59082C0.274787 8.49424 3.52078 11.5809 7.48926 11.5811C11.4578 11.5811 14.7027 8.49429 14.96 4.59082Z"
          fill="#FFFFFF"
          fillOpacity={0.2}
        />
        <Path
          d="M7.48926 0C9.74781 0 11.579 1.83132 11.5791 4.08984C11.5791 4.25912 11.5669 4.42596 11.5469 4.58984C11.3001 2.56728 9.57846 1 7.48926 1C5.40011 1.00013 3.67735 2.56728 3.43066 4.58984C3.4107 4.42602 3.40039 4.25906 3.40039 4.08984C3.4005 1.8314 5.23082 0.000142568 7.48926 0Z"
          fill="#FFFFFF"
          fillOpacity={0.2}
        />
      </G>
      <G x={24.421} y={34.793}>
        <Path
          d="M8.14648 0C8.16649 0.163946 8.1787 0.330653 8.17871 0.5C8.17871 2.75862 6.34749 4.58984 4.08887 4.58984C1.83036 4.5897 0 2.75854 0 0.5C8.3561e-06 0.330715 0.0102847 0.163888 0.0302734 0C0.276774 2.02276 1.99958 3.58971 4.08887 3.58984C6.17821 3.58984 7.89989 2.02276 8.14648 0Z"
          fill="#000000"
          fillOpacity={0.95}
        />
      </G>
    </Svg>
  );
}

function FirmwareGlyph({ fill }: { fill: IGlyphFill }) {
  return (
    <Svg width={BOX} height={BOX} viewBox={`0 0 ${BOX} ${BOX}`} fill="none">
      <G x={17} y={16}>
        <Path
          d="M11.1771 11.7838L0.700028 5.81023C0.89448 5.59244 1.09671 5.42133 1.30672 5.29688L9.87039 0.361681C10.2904 0.12056 10.726 0 11.1771 0C11.636 0 12.0755 0.12056 12.4955 0.361681L21.0592 5.29688C21.1758 5.36688 21.2808 5.44466 21.3742 5.53022C21.4753 5.61578 21.5686 5.70523 21.6542 5.79856L11.1771 11.7838ZM10.2437 13.4522V24.8627C10.1815 24.8471 10.1193 24.8199 10.0571 24.781C9.99484 24.7499 9.93262 24.7188 9.87039 24.6876L1.30672 19.7291C0.89448 19.4958 0.571689 19.1808 0.338347 18.7841C0.112782 18.3796 0 17.9402 0 17.4657V7.80531C0 7.72753 0 7.6653 0 7.61864L10.2437 13.4522ZM12.1221 13.4405L22.3542 7.5953C22.3542 7.62641 22.3542 7.66142 22.3542 7.70031C22.362 7.73142 22.3659 7.76253 22.3659 7.79364V17.4657C22.3659 17.9402 22.2492 18.3796 22.0159 18.7841C21.7903 19.1808 21.4714 19.4958 21.0592 19.7291L12.5072 24.6876C12.3672 24.7577 12.2388 24.816 12.1221 24.8627V13.4405Z"
          fill={fill.color}
          fillOpacity={fill.opacity}
        />
      </G>
      <G x={17} y={16}>
        <Path
          d="M10.2441 13.4521V14.4521L0 8.61816V7.61816L10.2441 13.4521Z"
          fill="#000000"
          fillOpacity={0.9}
        />
        <Path
          d="M22.3545 7.7002C22.3623 7.73131 22.3662 7.76283 22.3662 7.79395V8.79395C22.3662 8.76283 22.3623 8.73131 22.3545 8.7002V8.5957L12.1221 14.4404V13.4404L22.3545 7.5957V7.7002Z"
          fill="#000000"
          fillOpacity={0.9}
        />
        <Path
          d="M11.1768 0C11.6355 0 12.0752 0.120375 12.4951 0.361328L21.0596 5.29688C21.1761 5.36682 21.2808 5.44481 21.374 5.53027C21.4751 5.61583 21.5687 5.70549 21.6543 5.79883L20.9209 6.2168L12.4951 1.36133C12.0752 1.12037 11.6355 1 11.1768 1C10.7258 1.00006 10.29 1.12027 9.87012 1.36133L1.42871 6.22559L0.700195 5.81055C0.89463 5.59278 1.09665 5.42132 1.30664 5.29688L9.87012 0.361328C10.29 0.12027 10.7258 6.28349e-05 11.1768 0Z"
          fill="#000000"
          fillOpacity={0.9}
        />
      </G>
      <G x={17} y={21.217}>
        <Path
          d="M0 11.249C2.00632e-05 11.7234 0.11239 12.163 0.337891 12.5674C0.571233 12.9641 0.894402 13.2794 1.30664 13.5127L9.87012 18.4707C9.93226 18.5018 9.99449 18.5334 10.0566 18.5645C10.0878 18.5839 10.1192 18.6006 10.1504 18.6143L10.2441 18.6455V19.6455C10.1819 19.63 10.1189 19.6033 10.0566 19.5645C9.99449 19.5334 9.93226 19.5018 9.87012 19.4707L1.30664 14.5127C0.894402 14.2794 0.571233 13.9641 0.337891 13.5674C0.11239 13.163 2.00632e-05 12.7234 0 12.249V11.249Z"
          fill="#FFFFFF"
          fillOpacity={0.2}
        />
        <Path
          d="M22.3662 12.249C22.3662 12.7234 22.2489 13.163 22.0156 13.5674C21.7901 13.9639 21.4717 14.2794 21.0596 14.5127L12.5068 19.4707C12.3669 19.5406 12.2387 19.5989 12.1221 19.6455V18.6455C12.2387 18.5989 12.3669 18.5406 12.5068 18.4707L21.0596 13.5127C21.4717 13.2794 21.7901 12.9639 22.0156 12.5674C22.2489 12.163 22.3662 11.7234 22.3662 11.249V12.249Z"
          fill="#FFFFFF"
          fillOpacity={0.2}
        />
        <Path
          d="M21.0596 0.0800781C21.1761 0.15002 21.2808 0.228011 21.374 0.313477C21.4751 0.399036 21.5687 0.488694 21.6543 0.582031L11.1768 6.56738L0.700195 0.59375C0.89463 0.375983 1.09665 0.204525 1.30664 0.0800781L1.42871 0.00878906L11.1768 5.56738L20.9209 0L21.0596 0.0800781Z"
          fill="#FFFFFF"
          fillOpacity={0.2}
        />
      </G>
    </Svg>
  );
}

export type ICheckStepIllustrationKind = 'genuine' | 'firmware';
export type ICheckStepIllustrationTone = keyof typeof TONE_FILLS;

export interface ICheckStepIllustrationProps {
  kind: ICheckStepIllustrationKind;
  // Base glyph tint: neutral (idle / in progress), success, warning, critical.
  tone: ICheckStepIllustrationTone;
  // Run the border beam (the in-progress cue).
  beaming?: boolean;
}

// Memoized: it's a primitive-prop leaf, so a page re-render that changes only
// the other step's state skips rebuilding this one's (static) SVG glyph tree.
export const CheckStepIllustration = memo(
  ({ kind, tone, beaming }: ICheckStepIllustrationProps) => {
    const fill = TONE_FILLS[tone];
    return (
      <YStack
        w={BOX}
        h={BOX}
        borderRadius={BOX_RADIUS}
        borderCurve="continuous"
        overflow="hidden"
        bg="$gray3"
        $platform-web={{ boxShadow: SETUP_CARD_SHADOW }}
        $platform-native={{
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: '$neutral5',
        }}
      >
        <LinearGradient
          colors={BG_SHEEN}
          start={GRADIENT_TOP}
          end={GRADIENT_BOTTOM}
          style={StyleSheet.absoluteFill}
        />
        {/* Border — the static inner ring (Figma layer of the same name). */}
        <YStack
          position="absolute"
          left={RING_INSET}
          top={RING_INSET}
          w={RING}
          h={RING}
          borderRadius={RING_RADIUS}
          borderCurve="continuous"
          borderWidth={RING_STROKE}
          borderColor="$blackA5"
        />
        {beaming ? <BorderBeam /> : null}
        {/* zIndex lifts the glyph above the absolute layers — on web, positioned
          elements otherwise paint over in-flow content regardless of order.
          Keyed on tone so a state change cross-fades old/new tints in place. */}
        <YStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={1}
          pointerEvents="none"
        >
          <Animated.View key={tone} entering={TONE_ENTER} exiting={TONE_EXIT}>
            {kind === 'genuine' ? (
              <GenuineGlyph fill={fill} />
            ) : (
              <FirmwareGlyph fill={fill} />
            )}
          </Animated.View>
        </YStack>
      </YStack>
    );
  },
);
CheckStepIllustration.displayName = 'CheckStepIllustration';
