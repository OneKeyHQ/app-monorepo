import { useEffect, useRef } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';

import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Icon, XStack, YStack } from '@onekeyhq/components';

import { SetupCard } from './SetupCard';

import type { ImageSourcePropType } from 'react-native';

// Re-export so existing callers can keep importing the body slot from here.
export { SetupCardBody } from './SetupCard';

// A single row in the device-setup vertical stepper (Figma: "SetupStep" =
// SetupConnector + SetupCard). This file owns the left status column (state
// indicator icon + timeline rail); the card itself is the shared `SetupCard`.
//
// `state` lives only here and only drives: the indicator icon, the title color,
// whether the card is elevated, and whether the body/footer are revealed.
//
// States:
//   - pending:    hollow gray ring  + muted title  (flat card, title only)
//   - inProgress: hollow green ring + green title  (elevated card: header →
//                 body slot → footer with device + instruction)
//   - done:       filled green check + muted title  (flat card, title only)
export type ISetupStepState = 'pending' | 'inProgress' | 'done';

// Fixed pill count for the dotted rail — enough to overflow the tallest card,
// with the excess clipped by overflow:hidden. Hoisted so the array isn't
// reallocated on every render.
const CONNECTOR_DOTS = Array.from({ length: 60 });

// A reanimated-driven YStack, so a layer can cross-fade (and the check can pop)
// off the JS thread. Reanimated can't tween the Icon's color — the SVG fill is
// resolved in JS render, not from an animatable style prop — so color changes
// are done by cross-fading whole icons instead.
const AnimatedYStack = Animated.createAnimatedComponent(YStack);

// Color cross-fades (gray ring ⇄ green ring; neutral rail → brand rail) read as
// a smooth recolor, so a gentle CSS-ease. The done check enters on ease-out.
const COLOR_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);
const CHECK_EASING = Easing.out(Easing.cubic);

const RING_FADE_MS = 180;
const CHECK_ENTER_MS = 220;
const CHECK_EXIT_MS = 160; // exits ~25% quicker than they enter
const CONNECTOR_FADE_MS = 240;

// One cross-fading layer in the 20×20 indicator stack. Always mounted; only its
// opacity (and, for the done check, scale) animates — so gray ring ⇄ green ring
// reads as a recolor, and the check pops in over the fading ring. GPU-cheap
// (opacity/transform only) and respects the reduced-motion system setting. The
// initial value is the resting target, so static states (the gallery) don't
// animate on mount.
function StepIconLayer({
  visible,
  pop,
  children,
}: {
  visible: boolean;
  pop?: boolean;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(visible ? 1 : 0);
  const hasMounted = useRef(false);
  useEffect(() => {
    const target = visible ? 1 : 0;
    // First render (and reduced motion) settle instantly — no animation on
    // static rows like the gallery; later state changes animate.
    if (!hasMounted.current || reduceMotion) {
      hasMounted.current = true;
      progress.value = target;
      return;
    }
    let duration = RING_FADE_MS;
    if (pop) {
      duration = visible ? CHECK_ENTER_MS : CHECK_EXIT_MS;
    }
    progress.value = withTiming(target, {
      duration,
      easing: pop && visible ? CHECK_EASING : COLOR_EASING,
    });
  }, [visible, pop, reduceMotion, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: pop ? 0.8 + progress.value * 0.2 : 1 }],
  }));
  // Explicit w/h: Yoga doesn't content-size an absolute node, so the layer would
  // collapse to 0×0 on native without it (it only shrink-fits on web).
  return (
    <AnimatedYStack
      position="absolute"
      top={0}
      left={0}
      w="$5"
      h="$5"
      alignItems="center"
      justifyContent="center"
      style={style}
    >
      {children}
    </AnimatedYStack>
  );
}

// The 20×20 status dot at the head of each step. Stacked, cross-fading layers,
// bottom → top:
//   - gray ring: the pending look — a translucent $iconSubdued ring over the
//     dark card. Shown for pending AND inProgress; fades out on done.
//   - green ring: fades IN over the gray one for inProgress. $brand8 is opaque,
//     so it fully covers the gray beneath — pending→inProgress is a dip-free
//     recolor (the gray base stays put while the green builds on top, so the ring
//     never goes transparent). Gray MUST be the base, not the overlay: it's
//     translucent, so a green base would bleed through and tint pending.
//   - green check: pops in for done as the rings fade out beneath it.
function SetupStepIcon({ state }: { state: ISetupStepState }) {
  return (
    <YStack w="$5" h="$5">
      <StepIconLayer visible={state !== 'done'}>
        <Icon
          name="CirclePlaceholderOnOutline"
          size="$5"
          color="$iconSubdued"
        />
      </StepIconLayer>
      <StepIconLayer visible={state === 'inProgress'}>
        <Icon name="CirclePlaceholderOnOutline" size="$5" color="$brand8" />
      </StepIconLayer>
      <StepIconLayer visible={state === 'done'} pop>
        <Icon name="CheckRadioSolid" size="$5" color="$brand9" />
      </StepIconLayer>
    </YStack>
  );
}

// A full-height dotted rail in one color — stacked pills (the cross-platform
// connector idiom used by the keyless step cards), clipped by the parent.
function ConnectorRail({ color }: { color: string }) {
  return (
    <YStack gap="$1">
      {CONNECTOR_DOTS.map((_, i) => (
        <YStack
          key={i}
          w="100%"
          h="$1"
          flexShrink={0}
          bg={color}
          borderRadius="$full"
        />
      ))}
    </YStack>
  );
}

// Vertical timeline rail below the dot. A neutral base rail with a brand rail
// cross-fading in over it as the step completes, so the color change glides
// instead of snapping. Positioned absolutely so it adapts to the
// collapsed/expanded card height, and bleeds past the item bottom into the next
// item's dot so the timeline reads as one continuous line (items must be stacked
// with no gap between them); both rails share the parent's overflow clip.
// Respects the reduced-motion system setting.
function SetupStepConnectorLine({ state }: { state: ISetupStepState }) {
  const isDone = state === 'done';
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(isDone ? 1 : 0);
  const hasMounted = useRef(false);
  useEffect(() => {
    const target = isDone ? 1 : 0;
    // Settle instantly on first render / reduced motion; animate later changes.
    if (!hasMounted.current || reduceMotion) {
      hasMounted.current = true;
      progress.value = target;
      return;
    }
    progress.value = withTiming(target, {
      duration: CONNECTOR_FADE_MS,
      easing: COLOR_EASING,
    });
  }, [isDone, reduceMotion, progress]);
  const brandStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  return (
    <YStack
      position="absolute"
      top={44}
      bottom={-36}
      left={9}
      w={2}
      overflow="hidden"
    >
      <ConnectorRail color="$neutral6" />
      <AnimatedYStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        style={brandStyle}
      >
        <ConnectorRail color="$brand9" />
      </AnimatedYStack>
    </YStack>
  );
}

export interface ISetupStepItemProps extends PropsWithChildren {
  state: ISetupStepState;
  title: string;
  // Show the left status column (state indicator icon + timeline rail).
  // Defaults to true; set false to render the card alone, full width.
  showIndicator?: boolean;
  // Draw the timeline rail down to the next step (hide on the last item).
  showConnector?: boolean;
  // Footer (InProgress only) — a device thumbnail + a one-line instruction.
  // The footer renders only when `instruction` is provided.
  instruction?: string;
  deviceImage?: ImageSourcePropType;
  // Absolute background layer for the InProgress card (e.g. SetupCardBackground).
  backgroundSlot?: ReactNode;
  // Identity of the InProgress body, so the card cross-fades when its content is
  // replaced in place (the Setup step cycling through its sub-statuses).
  contentKey?: string | number;
}

export function SetupStepItem({
  state,
  title,
  showIndicator = true,
  showConnector,
  instruction,
  deviceImage,
  backgroundSlot,
  contentKey,
  children,
}: ISetupStepItemProps) {
  const isInProgress = state === 'inProgress';
  // The card's content slots (footer instruction, device thumbnail, background,
  // body) only apply to the expanded InProgress card; collapsed pending/done
  // rows render the title alone.
  const contentProps = isInProgress
    ? { instruction, deviceImage, backgroundSlot, contentKey }
    : undefined;

  return (
    <XStack gap="$3" pb={showIndicator && showConnector ? '$5' : 0}>
      {/* Left status column: state indicator icon + timeline rail. */}
      {showIndicator ? (
        <YStack pt="$5">
          <SetupStepIcon state={state} />
          {showConnector ? <SetupStepConnectorLine state={state} /> : null}
        </YStack>
      ) : null}

      <SetupCard
        flex={1}
        elevated={isInProgress}
        title={title}
        titleColor={isInProgress ? '$brand9' : '$textSubdued'}
        {...contentProps}
      >
        {isInProgress ? children : null}
      </SetupCard>
    </XStack>
  );
}
