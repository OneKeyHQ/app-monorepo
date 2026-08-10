import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useThemeName } from '@onekeyhq/components/src/hooks/useStyle';
import { TamaguiTheme as Theme } from '@onekeyhq/components/src/shared/tamagui';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { easeInFn, easeOutFn } from '../../content/deviceScene';
import {
  HardwareDevice,
  hardwareDeviceSwapMs,
} from '../../content/HardwareDevice';
import { SizableText, YStack } from '../../primitives';
import { DialogV2 } from '../DialogV2';

import {
  COMPACT_PORT_HEIGHT,
  COMPACT_SCALE,
  PORT_HEIGHT,
  REPLICA_WIDTH,
} from './consts';
import { ReplicaPort } from './ReplicaPort';

import type { IDeviceStageProps, IDeviceStageStep } from './type';

/**
 * A dark theater in both app themes, built two ways. Over a light app the
 * face is opaque near-black paint — translucency is what let the light theme
 * wash the glass out. Over a dark app the paint comes off and the system's
 * dark sheet material plays the stage itself: it is naturally deep there, and
 * it carries its own edge definition, which flat paint erases. The content
 * pins dark either way, and the port's mask dissolves the replica's foot the
 * same way over both faces. No footer: what happens next is decided on the
 * device, and stepping away is the sheet's own dismissal gesture.
 *
 * The stage moves strictly one motion at a time, each beat starting only
 * after the one before it has fully finished. A step change lets the
 * replica's screen play its whole content handover (out, then in), and
 * only then swaps the words. Entering confirm chains longer: the
 * arrangement shrinks the stage around the full-body miniature while the
 * screen keeps its old content, then the screen hands over, then the
 * words swap, then the payload card fades in. Serial beats read calmer
 * than parallel ones — and they never stack animated layers, which is
 * what stutters. The port's height animates with the arrangement, so the
 * sheet — which sizes to content on both engines — travels with it; the
 * payload card's space instead appears in one piece, its growth left to
 * the sheet's own animation (see the card below).
 */

const STAGE_BG = '#0A0A0C';

/** The stage's own side padding. The payload card's box sits exactly this
 * much wider on each side and pads back in by the same amount, so the
 * card TEXT keeps the words' left edge while the box reaches wider — the
 * flow spec's alignment. */
const STAGE_PADDING = 12;

/* ----------------------- stage choreography ----------------------- *
 * One value per concern: the compact arrangement (per step), the card
 * reveal (confirm's last beat), and the text swap (its own delayed
 * two-phase sequence inside StepText). The screen's handover is the
 * replica's own move; the stage queues everything after it. */

const ARRANGE_MS = 560;
const arrangeEase = Easing.bezierFn(0.4, 0, 0.2, 1);

const TEXT_OUT_MS = 200;
const TEXT_IN_MS = 280;
const TEXT_OUT_RISE = 14;
const TEXT_IN_DROP = 18;

/** Gap between the word swap ending and the payload card starting. */
const CARD_IN_GAP_MS = 80;
const CARD_IN_MS = 320;

/* The receive page's address grammar, redrawn for the stage card: mono,
 * grouped by four, the first and last six characters highlighted. */
const CARD_GROUP_SIZE = 4;
const CARD_HIGHLIGHT_ENDS = 6;
const CARD_MONO = {
  fontSize: 16,
  lineHeight: 24,
  fontFamily: '$monoMedium',
} as const;

/** Words tucked into the device foot (large) vs clear below (compact). */
const TEXT_TUCK_MARGIN = -60;
const TEXT_CLEAR_MARGIN = 20;

// `off` has no words of its own: searching is part of connecting, so the
// copy is in place from the first frame and holds still while the screen
// renders its content in — one literal, shared, so they cannot drift.
const CONNECTING_TEXT = {
  title: 'Connecting…',
  sub: 'Keep your device nearby.',
};

/** Wallet grammar: an instruction-first title, one informative line under. */
const STEP_TEXT: Record<IDeviceStageStep, { title: string; sub?: string }> = {
  off: CONNECTING_TEXT,
  connecting: CONNECTING_TEXT,
  enterPin: { title: 'Enter PIN', sub: 'Unlock your device.' },
  enterPassphrase: { title: 'Enter passphrase on your device' },
  confirm: { title: 'Confirm on your device' },
};

const styles = StyleSheet.create({
  device: {
    // Shrink toward the top center so the replica stays put while the
    // port closes around it.
    transformOrigin: 'top',
  },
  textWrap: {
    zIndex: 1,
  },
  textBlock: {
    gap: 6,
  },
  cardBox: {
    marginHorizontal: -STAGE_PADDING,
  },
  // The window onto the port: the stage animates its height, the port
  // itself keeps its full geometry behind it.
  portWindow: {
    alignSelf: 'center',
    width: REPLICA_WIDTH,
    overflow: 'hidden',
  },
});

/**
 * The step's words, swapped as one block: the outgoing pair lifts out and
 * fades, then the incoming pair rises in from below — strictly in that
 * order, so the two never share the stage. `delayMs` holds the whole swap
 * until the beats before it have finished, keeping the stage's motions
 * serial; with `animated` off (the sheet is closed, or motion is reduced)
 * the words snap, so a reopened stage never replays a stale swap.
 */
function StepText({
  title,
  sub,
  delayMs,
  animated,
}: {
  title: string;
  sub: string;
  delayMs: number;
  animated: boolean;
}) {
  const [shown, setShown] = useState({ title, sub });
  const targetRef = useRef({ title, sub });
  targetRef.current = { title, sub };
  const opacity = useSharedValue(1);
  const shift = useSharedValue(0);
  const enter = useCallback(() => {
    setShown(targetRef.current);
    shift.value = TEXT_IN_DROP;
    opacity.value = withTiming(1, { duration: TEXT_IN_MS, easing: easeOutFn });
    shift.value = withTiming(0, { duration: TEXT_IN_MS, easing: easeOutFn });
  }, [opacity, shift]);
  useEffect(() => {
    if (shown.title === title && shown.sub === sub) return;
    if (!animated) {
      cancelAnimation(opacity);
      cancelAnimation(shift);
      opacity.value = 1;
      shift.value = 0;
      setShown({ title, sub });
      return;
    }
    cancelAnimation(opacity);
    cancelAnimation(shift);
    shift.value = withDelay(
      delayMs,
      withTiming(-TEXT_OUT_RISE, { duration: TEXT_OUT_MS, easing: easeInFn }),
    );
    opacity.value = withDelay(
      delayMs,
      withTiming(0, { duration: TEXT_OUT_MS, easing: easeInFn }, (finished) => {
        if (finished) runOnJS(enter)();
      }),
    );
  }, [animated, delayMs, enter, opacity, shift, shown, sub, title]);
  const motionStyle = useAnimatedStyle(
    () => ({
      opacity: opacity.value,
      transform: [{ translateY: shift.value }],
    }),
    [opacity, shift],
  );
  const style = useMemo(() => [styles.textBlock, motionStyle], [motionStyle]);
  return (
    <Animated.View style={style}>
      <SizableText fontSize={24} lineHeight={30} fontWeight="700">
        {shown.title}
      </SizableText>
      <SizableText
        fontSize={15}
        lineHeight={21}
        minHeight={21}
        color="$textSubdued"
      >
        {shown.sub}
      </SizableText>
    </Animated.View>
  );
}

/**
 * A card row's value. With `highlightEnds` it takes the receive page's
 * address grammar: mono, grouped by four, the first and last six
 * characters highlighted — what the person compares against the device.
 */
function CardValue({
  value,
  highlightEnds,
}: {
  value: string;
  highlightEnds?: boolean;
}) {
  const parts = useMemo(() => {
    if (!highlightEnds || value.length <= CARD_HIGHLIGHT_ENDS * 2) {
      return null;
    }
    const grouped = stringUtils.addSeparatorToString({
      str: value,
      groupSize: CARD_GROUP_SIZE,
      separator: ' ',
    });
    // Original char position -> grouped position (one space per group).
    const pos = (index: number) => index + Math.floor(index / CARD_GROUP_SIZE);
    const leadEnd = pos(CARD_HIGHLIGHT_ENDS);
    const trailStart = pos(value.length - CARD_HIGHLIGHT_ENDS);
    return {
      leading: grouped.slice(0, leadEnd),
      middle: grouped.slice(leadEnd, trailStart),
      trailing: grouped.slice(trailStart),
    };
  }, [highlightEnds, value]);
  if (!parts) {
    return (
      <SizableText fontSize={15} lineHeight={24}>
        {value}
      </SizableText>
    );
  }
  return (
    <SizableText {...CARD_MONO} color="$text">
      <SizableText {...CARD_MONO} color="$textInteractive">
        {parts.leading}
      </SizableText>
      {parts.middle}
      <SizableText {...CARD_MONO} color="$textInteractive">
        {parts.trailing}
      </SizableText>
    </SizableText>
  );
}

export function DeviceStage({
  open,
  onOpenChange,
  deviceType,
  step,
  confirmContext,
  confirmDetails,
  locked,
  backgroundInteractive,
}: IDeviceStageProps) {
  // Ambient theme, read outside the dark pin below: it decides whether the
  // sheet face needs paint at all.
  const ambientDark = useThemeName().includes('dark');
  const reducedMotion = useReducedMotion();
  // Nothing to choreograph with the sheet closed, and nothing to
  // choreograph under reduced motion: everything below snaps instead.
  const animated = open && !reducedMotion;
  const compactTarget = step === 'confirm';
  // How long this model's screen takes to hand over — the beat every move
  // the stage owns queues behind.
  const swapMs = hardwareDeviceSwapMs(deviceType);

  // What the replica plays. On a change that involves the compact
  // arrangement the scene holds until the geometry has landed, so the
  // screen's handover never runs while the stage is moving.
  const [scene, setScene] = useState(step);
  useEffect(() => {
    if (scene === step) return undefined;
    const involvesCompact = step === 'confirm' || scene === 'confirm';
    if (!animated || !involvesCompact) {
      setScene(step);
      return undefined;
    }
    const id = setTimeout(() => setScene(step), ARRANGE_MS);
    return () => clearTimeout(id);
  }, [animated, scene, step]);

  // The words follow the scene rather than the step, which is what puts
  // them after the arrangement without a second copy of its timing: the
  // scene already lags by ARRANGE_MS exactly when confirm is involved, so
  // the swap only ever has the screen's handover left to wait out.
  const text = STEP_TEXT[scene];
  const sub = (scene === 'confirm' ? confirmContext : text.sub) ?? '';

  // The compact arrangement.
  const compact = useSharedValue(compactTarget ? 1 : 0);
  useEffect(() => {
    cancelAnimation(compact);
    if (!animated) {
      compact.value = compactTarget ? 1 : 0;
      return;
    }
    compact.value = withTiming(compactTarget ? 1 : 0, {
      duration: ARRANGE_MS,
      easing: arrangeEase,
    });
  }, [animated, compact, compactTarget]);

  // The payload card, confirm's last beat. Its space appears in one piece
  // when it mounts — the sheet animates that height change natively — and
  // only opacity animates here: an animated height re-lays-out the whole
  // sheet every frame, which is what stuttered.
  const [cardShown, setCardShown] = useState(compactTarget);
  const cardIn = useSharedValue(compactTarget ? 1 : 0);
  useEffect(() => {
    cancelAnimation(cardIn);
    if (!animated) {
      setCardShown(compactTarget);
      cardIn.value = compactTarget ? 1 : 0;
      return undefined;
    }
    if (!compactTarget) {
      setCardShown(false);
      cardIn.value = 0;
      return undefined;
    }
    // After the arrangement, the screen handover and the word swap have
    // all fully finished.
    const delayMs =
      ARRANGE_MS + swapMs + TEXT_OUT_MS + TEXT_IN_MS + CARD_IN_GAP_MS;
    const id = setTimeout(() => {
      cardIn.value = 0;
      setCardShown(true);
      cardIn.value = withTiming(1, { duration: CARD_IN_MS, easing: easeOutFn });
    }, delayMs);
    return () => clearTimeout(id);
  }, [animated, cardIn, compactTarget, swapMs]);

  const portWindowMotionStyle = useAnimatedStyle(
    () => ({
      height: PORT_HEIGHT + compact.value * (COMPACT_PORT_HEIGHT - PORT_HEIGHT),
    }),
    [compact],
  );
  const portWindowStyle = useMemo(
    () => [styles.portWindow, portWindowMotionStyle],
    [portWindowMotionStyle],
  );
  const deviceMotionStyle = useAnimatedStyle(
    () => ({
      transform: [{ scale: 1 + compact.value * (COMPACT_SCALE - 1) }],
    }),
    [compact],
  );
  const deviceStyle = useMemo(
    () => [styles.device, deviceMotionStyle],
    [deviceMotionStyle],
  );
  const textMarginStyle = useAnimatedStyle(
    () => ({
      marginTop:
        TEXT_TUCK_MARGIN +
        compact.value * (TEXT_CLEAR_MARGIN - TEXT_TUCK_MARGIN),
    }),
    [compact],
  );
  const textStyle = useMemo(
    () => [styles.textWrap, textMarginStyle],
    [textMarginStyle],
  );

  const cardFadeStyle = useAnimatedStyle(
    () => ({ opacity: cardIn.value }),
    [cardIn],
  );
  const cardStyle = useMemo(
    () => [styles.cardBox, cardFadeStyle],
    [cardFadeStyle],
  );

  return (
    // The dark pin drives both the stage tokens and, through DialogV2's
    // ambient mirroring, the sheet chrome on native.
    <Theme name="dark">
      <DialogV2
        open={open}
        onOpenChange={onOpenChange}
        dismissible={!locked}
        background={ambientDark ? undefined : STAGE_BG}
        backgroundInteractive={backgroundInteractive}
      >
        <YStack pt="$4" px={STAGE_PADDING}>
          <Animated.View style={portWindowStyle}>
            <ReplicaPort>
              {/* Step names and scene names deliberately coincide: every step
                is also the scene each replica plays of it (for some, a still
                device with a dark screen — exactly what the physical device
                shows at that moment). The one exception is `off`, the step
                before any scene: the bare shell, screen dark, nothing
                rendered in yet. */}
              <Animated.View style={deviceStyle}>
                <HardwareDevice
                  deviceType={deviceType}
                  animation={scene === 'off' ? undefined : scene}
                  width={REPLICA_WIDTH}
                />
              </Animated.View>
            </ReplicaPort>
          </Animated.View>
          <Animated.View style={textStyle}>
            <StepText
              title={text.title}
              sub={sub}
              delayMs={swapMs}
              animated={animated}
            />
          </Animated.View>
          {confirmDetails?.length && cardShown ? (
            <Animated.View style={cardStyle}>
              <YStack
                mt="$6"
                borderRadius="$3"
                bg="rgba(255,255,255,0.06)"
                px={STAGE_PADDING}
                py="$3"
                gap="$3"
              >
                {confirmDetails.map((row) => (
                  <YStack key={row.label} gap="$2">
                    <SizableText
                      fontSize={13}
                      lineHeight={16}
                      color="$textSubdued"
                    >
                      {row.label}
                    </SizableText>
                    <CardValue
                      value={row.value}
                      highlightEnds={row.highlightEnds}
                    />
                  </YStack>
                ))}
              </YStack>
            </Animated.View>
          ) : null}
        </YStack>
      </DialogV2>
    </Theme>
  );
}

export type { IDeviceStageProps, IDeviceStageStep } from './type';
