import { useCallback, useEffect, useRef } from 'react';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';

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
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { IYStackProps } from '@onekeyhq/components';
import {
  LinearGradient,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { makeSequencedFade } from './setupMotion';

import type { ImageSourcePropType, LayoutChangeEvent } from 'react-native';

// The shared card shell for the device-setup UI (Figma: "SetupCard", the inner
// half of "SetupStep" = SetupConnector + SetupCard). Pure presentation.
//
// Three optional slots, each shown only when it has content — so the same shell
// serves both stepper rows and the standalone full-card states (status check /
// device ready / fallback) just by what you pass in:
//   - header: rendered iff `title` is set
//   - body:   `children`
//   - footer: rendered iff `instruction` is set (device thumbnail + one line)
//
// `elevated` paints the dark surface (bg + layered shadow + native border);
// leave it off for the collapsed pending/done rows, which are transparent.

// Layered drop shadow + inner edge highlight for the elevated card (web).
// Mirrors the popup shadow recipe used elsewhere in onboarding.
export const SETUP_CARD_SHADOW =
  'inset 0 1px 0 0 rgba(255, 255, 255, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.16), 0 1px 1px -0.5px rgba(0, 0, 0, 0.18), 0 3px 3px -1.5px rgba(0, 0, 0, 0.18), 0 6px 6px -3px rgba(0, 0, 0, 0.18), 0 12px 12px -6px rgba(0, 0, 0, 0.18)';

// White sheen wash for elevated card surfaces: 12% → 0% white, laid over a
// $gray3 base as a LinearGradient (the gradient direction is per-card).
// Shared by the onboarding illustrations.
export const BG_SHEEN = ['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0)'];

const CARD_RADIUS = 24;

// A reanimated-driven Tamagui YStack so the card can animate its own height as
// its content changes. Built on reanimated (measure + withTiming) on purpose —
// NOT Tamagui's `animation` prop or the HeightTransition component, whose height
// animations are unreliable here.
const AnimatedYStack = Animated.createAnimatedComponent(YStack);

const HEIGHT_EASING = Easing.bezier(0.22, 1, 0.36, 1);

// Body/footer enter/exit, and the in-place body swap when `contentKey` changes
// (the Setup card cycling choice / create / restore): a sequenced ("mode=wait")
// opacity fade — see makeSequencedFade. (On the body's first reveal there's
// nothing to exit, so the content lands ~one exit-length after the card opens.)
const { entering: CONTENT_ENTER, exiting: CONTENT_EXIT } = makeSequencedFade({
  enterMs: 220,
  exitMs: 160,
});

export interface ISetupCardGlowProps {
  // Gradient color (hex).
  color: string;
  // Diameter of the radial in px (default 466).
  size?: number;
  // Vertical offset relative to the container; negative bleeds it up out of the
  // card top (default -233).
  top?: number;
  // Peak alpha at the centre, fading to 0 at the edge (default 0.2).
  opacity?: number;
}

// Soft radial glow bleeding down from the top of a card, centered horizontally
// and clipped by the card's rounded overflow. Drawn with react-native-svg (the
// same primitive the onboarding HeroAtmosphere uses). Place it as the first
// child of a position:relative container (e.g. a SetupCardBody) so it sits
// behind the content.
export function SetupCardGlow({
  color,
  size = 466,
  top = -233,
  opacity = 0.2,
}: ISetupCardGlowProps) {
  const glowId = `setup-card-glow-${color.replace('#', '')}-${size}`;
  return (
    <YStack
      position="absolute"
      top={top}
      left="50%"
      x={-size / 2}
      w={size}
      h={size}
      pointerEvents="none"
    >
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient
            id={glowId}
            cx="50%"
            cy="50%"
            rx="50%"
            ry="50%"
            fx="50%"
            fy="50%"
          >
            <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${glowId})`} />
      </Svg>
    </YStack>
  );
}

// A diagonal, translucent-white glint that sweeps left→right across the device
// screen, loops forever, and pauses between passes — a subtle "alive" cue while
// the step waits on the device. Clipped to the screen by its overflow:hidden.
// The animated translateX lives on the wrapper and the static tilt on an inner
// YStack, so the two transforms never fight. Holds still under reduced motion.
const SCREEN_W = 24; // the inner device screen the glint sweeps across
// A wide, soft band — the gradient ramps over ~13px each side rather than a few,
// so it reads as a delicate sheen washing across rather than a hard diagonal bar.
const SHINE_W = 26;
const SHINE_OVERHANG = 12; // extend above/below so the tilt covers the corners
const SHINE_TILT = '20deg';
const SHINE_TRAVEL = 14; // px past each edge so the band fully clears the screen
const SHINE_START = -(SHINE_W + SHINE_TRAVEL);
const SHINE_END = SCREEN_W + SHINE_TRAVEL;
const SHINE_SWEEP_MS = 1100; // a slower, more refined pass
const SHINE_PAUSE_MS = 2000;

function SetupCardDeviceShine() {
  const reduceMotion = useReducedMotion();
  const tx = useSharedValue(SHINE_START);
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(tx);
      tx.value = SHINE_START; // parked off-screen — no glint
      return undefined;
    }
    // Sweep across, hold parked off the right for the pause, snap back to the
    // left (both ends off-screen, so the reset is invisible), repeat forever.
    tx.value = withRepeat(
      withSequence(
        withTiming(SHINE_END, {
          duration: SHINE_SWEEP_MS,
          easing: Easing.inOut(Easing.sin),
        }),
        withDelay(SHINE_PAUSE_MS, withTiming(SHINE_START, { duration: 0 })),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(tx);
  }, [tx, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));
  return (
    <AnimatedYStack
      position="absolute"
      top={-SHINE_OVERHANG}
      bottom={-SHINE_OVERHANG}
      left={0}
      w={SHINE_W}
      pointerEvents="none"
      style={style}
    >
      <YStack flex={1} rotate={SHINE_TILT}>
        <LinearGradient
          colors={[
            'rgba(255, 255, 255, 0)',
            'rgba(255, 255, 255, 0.15)',
            'rgba(255, 255, 255, 0)',
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </YStack>
    </AnimatedYStack>
  );
}

// 40×40 framed device thumbnail shown in the footer (Figma "Device Container").
// A light device frame (top corners rounded, bottom square) holds a dark screen
// inset to the top — leaving a small chin — with a glint sweeping across the
// screen. Mock placeholder until the real device image is wired (Pro 2 can't
// connect yet).
function SetupCardDeviceFrame() {
  return (
    <YStack
      w={40}
      h={40}
      borderRadius="$3"
      bg="$whiteA1"
      borderCurve="continuous"
      $platform-web={{
        boxShadow: SETUP_CARD_SHADOW,
      }}
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$neutral3',
      }}
      overflow="hidden"
    >
      {/* Device body: light frame, top corners rounded, bottom square. */}
      <YStack
        position="absolute"
        left={7}
        top={7}
        w={26}
        h={40}
        bg="$whiteA1"
        borderWidth={1}
        borderColor="$whiteA3"
        borderTopLeftRadius={6}
        borderTopRightRadius={6}
        borderCurve="continuous"
      />
      {/* Screen: dark, inset 1px within the frame, top-rounded; clips the glint
          to its shape. */}
      <YStack
        position="absolute"
        left={8}
        top={8}
        w={24}
        h={36}
        bg="$blackA5"
        borderTopLeftRadius={5}
        borderTopRightRadius={5}
        borderCurve="continuous"
        overflow="hidden"
        borderWidth={1}
        borderColor="$blackA5"
      >
        <SetupCardDeviceShine />
      </YStack>
    </YStack>
  );
}

// Open body slot with the card's standard horizontal padding so dropped-in
// content lines up with the header/footer; every prop is overridable.
export function SetupCardBody({
  children,
  ...rest
}: PropsWithChildren<IYStackProps>) {
  return (
    <YStack px="$5" pb="$6" {...rest}>
      {children}
    </YStack>
  );
}

export interface ISetupCardProps extends IYStackProps {
  // Header shows iff provided.
  title?: string;
  titleColor?: ComponentProps<typeof SizableText>['color'];
  // Footer shows iff provided — a device thumbnail + a one-line instruction.
  instruction?: string;
  deviceImage?: ImageSourcePropType;
  // Paint the dark surface (bg + shadow + native border). Off = transparent.
  elevated?: boolean;
  // Absolute background layer rendered behind header/body/footer and clipped by
  // the card's rounded overflow (e.g. a SetupCardBackground or SetupCardGlow).
  backgroundSlot?: ReactNode;
  // Identity of the current body content. When it changes, the body cross-fades
  // (old exits, new enters) instead of swapping instantly — for cards whose body
  // is replaced in place while the card stays mounted (e.g. the Setup step
  // cycling through choice / create / restore). Leave unset for a stable body.
  contentKey?: string | number;
  children?: ReactNode;
}

export function SetupCard({
  title,
  titleColor = '$text',
  instruction,
  deviceImage,
  elevated,
  backgroundSlot,
  contentKey,
  children,
  ...rest
}: ISetupCardProps) {
  const reduceMotion = useReducedMotion();

  // Height transition: the inner wrapper is laid out at its natural height; the
  // clip box animates its own height to match and clips the difference, so
  // collapse/expand and body swaps glide instead of snapping. The clip box is a
  // flow child so the card auto-sizes on first render (no grow-from-zero); the
  // first measure is applied instantly, later ones animate.
  const height = useSharedValue(-1);
  const lastHeight = useRef(0);
  const hasMeasured = useRef(false);
  const onContentLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const next = Math.round(e.nativeEvent.layout.height);
      if (next <= 0 || next === lastHeight.current) {
        return;
      }
      lastHeight.current = next;
      if (hasMeasured.current && !reduceMotion) {
        height.value = withTiming(next, {
          duration: 300,
          easing: HEIGHT_EASING,
        });
      } else {
        hasMeasured.current = true;
        height.value = next;
      }
    },
    [height, reduceMotion],
  );
  const heightStyle = useAnimatedStyle(() => ({
    height: height.value < 0 ? undefined : height.value,
  }));

  // Elevated transition: the dark surface (bg + shadow + native border) lives on
  // its own layer behind the content and fades in/out with `elevated`, so
  // toggling it glides too. Kept off the clip box on purpose — an overflow:hidden
  // box would clip the drop shadow. First value is applied instantly (no fade on
  // mount); later changes animate.
  const surfaceOpacity = useSharedValue(elevated ? 1 : 0);
  useEffect(() => {
    const target = elevated ? 1 : 0;
    surfaceOpacity.value = reduceMotion
      ? target
      : withTiming(target, { duration: 250, easing: HEIGHT_EASING });
  }, [elevated, surfaceOpacity, reduceMotion]);
  const surfaceStyle = useAnimatedStyle(() => ({
    opacity: surfaceOpacity.value,
  }));

  return (
    <YStack position="relative" {...rest}>
      <AnimatedYStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        borderRadius={CARD_RADIUS}
        borderCurve="continuous"
        bg="$bg"
        $platform-web={{ boxShadow: SETUP_CARD_SHADOW }}
        $platform-native={{
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: '$neutral3',
        }}
        pointerEvents="none"
        style={surfaceStyle}
      />

      <AnimatedYStack
        borderRadius={CARD_RADIUS}
        borderCurve="continuous"
        overflow="hidden"
        style={heightStyle}
      >
        <YStack onLayout={onContentLayout}>
          {backgroundSlot}

          {title ? (
            <YStack p="$5">
              <SizableText size="$headingSm" color={titleColor}>
                {title}
              </SizableText>
            </YStack>
          ) : null}

          {children ? (
            <Animated.View
              key={contentKey}
              entering={CONTENT_ENTER}
              exiting={CONTENT_EXIT}
            >
              {children}
            </Animated.View>
          ) : null}

          {instruction ? (
            <Animated.View entering={CONTENT_ENTER} exiting={CONTENT_EXIT}>
              <XStack
                w="100%"
                alignItems="center"
                gap="$3"
                px="$5"
                pt={15}
                pb={14}
                bg="$whiteA1"
                borderTopWidth={StyleSheet.hairlineWidth}
                borderTopColor="$neutral3"
              >
                {deviceImage ? <SetupCardDeviceFrame /> : null}
                <SizableText flex={1} size="$bodyMdMedium" color="$text">
                  {instruction}
                </SizableText>
              </XStack>
            </Animated.View>
          ) : null}
        </YStack>
      </AnimatedYStack>
    </YStack>
  );
}
