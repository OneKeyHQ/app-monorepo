import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
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
import { Button, SizableText, YStack } from '../../primitives';
import { DialogV2 } from '../DialogV2';

import { PassphraseForm, PinPad } from './AppInputs';
import {
  COMPACT_PORT_HEIGHT,
  COMPACT_SCALE,
  PORT_HEIGHT,
  REPLICA_WIDTH,
} from './consts';
import { QrPresent, QrScanFrame } from './QrPanels';
import { ReplicaPort } from './ReplicaPort';

import type {
  IDeviceStageErrorReason,
  IDeviceStageProps,
  IDeviceStageStep,
} from './type';

/**
 * A dark theater in both app themes, built two ways. Over a light app the
 * face is opaque near-black paint — translucency is what let the light theme
 * wash the glass out. Over a dark app the paint comes off and the system's
 * dark sheet material plays the stage itself: it is naturally deep there, and
 * it carries its own edge definition, which flat paint erases. The content
 * pins dark either way, and the port's mask dissolves the replica's foot the
 * same way over both faces. No standing footer: what happens next is
 * decided on the device, and stepping away is the sheet's own dismissal
 * gesture — the one exception is the error beat's single recovery button.
 *
 * Some steps leave the replica out entirely: the app-side inputs, where
 * the person types here while the device waits, and the air-gap QR pair,
 * where the person is holding the device itself. Their panels swap on the
 * words' own two-phase beat: the outgoing side fades out, the content and
 * the sheet's height change on the empty beat — in one piece, honouring
 * the height contract — and the incoming side fades in whole. The stage
 * side is a standing set: hidden behind the panels rather than unmounted
 * (rebuilding its native tree froze the swap), it returns with its screen
 * already lit, the fade playing as its entrance; the slow wake-up ramp
 * belongs to cold opens and on-stage handovers. The endings (error,
 * success) play on the same surface as every other step: that surface
 * continuity is the point of the stage.
 *
 * The words swap the moment the step changes — the text waits for nothing.
 * What stays serial is the heavier machinery: entering confirm, the
 * arrangement shrinks the stage around the full-body miniature while the
 * screen keeps its old content, then the screen hands over, then the
 * payload card fades in. Those beats never stack animated layers, which
 * is what stutters. The port's height animates with the arrangement, so
 * the sheet — which sizes to content on both engines — travels with it;
 * the payload card's space instead appears in one piece, its growth left
 * to the sheet's own animation (see the card below).
 */

const STAGE_BG = '#0A0A0C';

/** How far the payload card's box reaches past the content edge on each
 * side; it pads back in by the same amount, so the card TEXT keeps the
 * words' left edge while the box reads wider — the flow spec's alignment.
 * Sides and bottom otherwise belong to the shell's content contract (24pt
 * inset, safe-area bottom): the stage writes no padding of its own. The
 * out-dent is capped at the native sheet's inner top-up — any further and
 * the box would cross the hosted view's boundary and risk clipping. */
const CARD_OUTDENT = 8;

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

/**
 * Which arrangement a step belongs to: its own panel when it plays without
 * the replica, one shared stage otherwise. A step change inside one
 * arrangement flows through live — the replica never remounts — while a
 * change of arrangement runs the two-phase swap below.
 */
function stagePanelOf(step: IDeviceStageStep): IDeviceStageStep | 'stage' {
  return step === 'pinOnApp' ||
    step === 'passphraseOnApp' ||
    step === 'showQr' ||
    step === 'scanQr'
    ? step
    : 'stage';
}

/** Gap between the screen handover ending and the payload card starting. */
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

/**
 * The standing theater's parking spot while a panel plays: invisible,
 * untouchable, and out of the sheet's measured height, but fully built —
 * anchored at the same top edge it occupies when active, so activating it
 * changes nothing but visibility.
 */
const STAGE_PARKED = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  opacity: 0,
  pointerEvents: 'none',
} as const;

// `off` has no words of its own: searching is part of connecting, so the
// copy is in place from the first frame and holds still while the screen
// renders its content in — one literal, shared, so they cannot drift.
const CONNECTING_TEXT = {
  title: 'Connecting…',
  sub: 'Keep your device nearby.',
};

/**
 * Failure copy by reason, each with its single recovery action. The stage
 * ends on the surface it played on: no toast, no second dialog.
 */
const ERROR_TEXT: Record<
  IDeviceStageErrorReason | 'generic',
  { title: string; sub: string; action: string }
> = {
  rejected: {
    title: 'Canceled on device',
    sub: 'The request was declined on the device.',
    action: 'Try again',
  },
  pinInvalid: {
    title: 'Wrong PIN',
    sub: 'The PIN did not match the device.',
    action: 'Re-enter PIN',
  },
  disconnected: {
    title: 'Device disconnected',
    sub: 'Check the connection, then try again.',
    action: 'Reconnect',
  },
  busy: {
    title: 'Device is busy',
    sub: 'Another operation is still running.',
    action: 'Try again',
  },
  generic: {
    title: 'Something went wrong',
    sub: 'Try again in a moment.',
    action: 'Try again',
  },
};

/** Wallet grammar: an instruction-first title, one informative line under. */
const STEP_TEXT: Record<IDeviceStageStep, { title: string; sub?: string }> = {
  off: CONNECTING_TEXT,
  connecting: CONNECTING_TEXT,
  // Titles name the place only when it is not here: the app is where the
  // person already is, so app-side steps stay bare and device-side steps
  // carry "on device" — the one fact that changes when a step hops sides.
  enterPin: { title: 'Enter PIN on device', sub: 'Unlock your device.' },
  // No sub on purpose: the pad's strip carries the teaching line.
  pinOnApp: { title: 'Enter PIN' },
  enterPassphrase: {
    title: 'Enter passphrase on device',
    sub: 'Each passphrase opens its own hidden wallet.',
  },
  passphraseOnApp: {
    title: 'Enter passphrase',
    sub: 'Case-sensitive; spaces count.',
  },
  // No sub: the panel's numbered steps carry the air-gap instructions.
  showQr: { title: 'Scan with your device' },
  scanQr: {
    title: 'Scan your device screen',
    sub: 'Aim at the code your device is showing.',
  },
  confirm: { title: 'Confirm on device' },
  processing: { title: 'Processing…', sub: 'Keep your device connected.' },
  error: ERROR_TEXT.generic,
  success: { title: '✓ Done' },
};

/**
 * What the replica's screen plays per step. `processing` keeps the
 * connecting scene's living wallpaper — the device is genuinely at work —
 * while the endings go dark: the stage mirrors state, it does not invent
 * what the physical screen shows. The app-side inputs and the air-gap
 * pair have no replica on stage at all (the off-stage branch below).
 */
const SCENE_ANIMATION: Record<
  IDeviceStageStep,
  ComponentProps<typeof HardwareDevice>['animation']
> = {
  off: undefined,
  connecting: 'connecting',
  enterPin: 'enterPin',
  pinOnApp: undefined,
  enterPassphrase: 'enterPassphrase',
  passphraseOnApp: undefined,
  showQr: undefined,
  scanQr: undefined,
  confirm: 'confirm',
  processing: 'connecting',
  error: undefined,
  success: undefined,
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
    marginHorizontal: -CARD_OUTDENT,
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
 * order, so the two never share the stage. The swap starts the moment the
 * step changes: the words wait for nothing else on the stage. With
 * `animated` off (the sheet is closed, or motion is reduced) they snap,
 * so a reopened stage never replays a stale swap.
 */
function StepText({
  title,
  sub,
  animated,
}: {
  title: string;
  sub: string;
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
    shift.value = withTiming(-TEXT_OUT_RISE, {
      duration: TEXT_OUT_MS,
      easing: easeInFn,
    });
    opacity.value = withTiming(
      0,
      { duration: TEXT_OUT_MS, easing: easeInFn },
      (finished) => {
        if (finished) runOnJS(enter)();
      },
    );
  }, [animated, enter, opacity, shift, shown, sub, title]);
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
      <SizableText size="$heading2xl">{shown.title}</SizableText>
      {shown.sub ? (
        <SizableText fontSize={15} lineHeight={21} color="$textSubdued">
          {shown.sub}
        </SizableText>
      ) : null}
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
  qrValue,
  onQrNext,
  onQrBack,
  errorReason,
  onErrorAction,
  onPinSubmit,
  passphraseMode,
  onPassphraseSubmit,
  onPassphraseAttachPin,
  onSwitchToDevice,
  inputError,
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

  // The arrangement swap: the words' two-phase grammar, one level up. A
  // step that replaces the whole arrangement fades the outgoing side out
  // and swaps the content on the empty beat — the sheet's height lands in
  // one piece there and its own resize animation carries the change. A
  // one-sided entering fade reads as a hard cut: the eye keys on the
  // outgoing content, and an entrance alone is swallowed by the sheet's
  // motion. The incoming side fades in whole — the standing theater is
  // only revealed, never rebuilt, and its screen comes up already lit
  // (the instant-entry grant below): the fade is the entrance, where the
  // wake-up ramp would sit under it as a beat of pure black. Everything
  // below reads `shownStep`, so the whole stage plays the held step as
  // one; steps inside one arrangement pass through live.
  const [heldStep, setHeldStep] = useState(step);
  const crossing = stagePanelOf(heldStep) !== stagePanelOf(step);
  const shownStep = crossing ? heldStep : step;
  const stepTargetRef = useRef(step);
  stepTargetRef.current = step;
  // Whether the sheet was already up when the step arrived: presenting
  // straight onto a step must not replay a swap over stale content.
  const wasOpenRef = useRef(open);
  const swapFade = useSharedValue(1);
  // Only lands the step. The reveal happens in the effect below, AFTER
  // the landed content has committed — a shared-value write issued next
  // to the setState reaches the UI thread a frame before React swaps the
  // tree, and relights the outgoing panel for that frame.
  const landPanel = useCallback(() => {
    setHeldStep(stepTargetRef.current);
  }, []);
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    if (heldStep === step) {
      // The reveal after a landing — and the re-aim that heals an
      // interrupted out-phase, so the stage can never stay half-lit.
      cancelAnimation(swapFade);
      if (animated) {
        swapFade.value = withTiming(1, {
          duration: TEXT_IN_MS,
          easing: easeOutFn,
        });
      } else {
        swapFade.value = 1;
      }
      return;
    }
    if (stagePanelOf(heldStep) === stagePanelOf(step)) {
      // Same arrangement: `shownStep` already follows the live step —
      // this only keeps the bookkeeping current.
      setHeldStep(step);
      return;
    }
    if (!animated || !wasOpen) {
      cancelAnimation(swapFade);
      swapFade.value = 1;
      setHeldStep(step);
      return;
    }
    cancelAnimation(swapFade);
    swapFade.value = withTiming(
      0,
      { duration: TEXT_OUT_MS, easing: easeInFn },
      (finished) => {
        if (finished) runOnJS(landPanel)();
      },
    );
  }, [animated, heldStep, landPanel, step, swapFade]);
  useEffect(() => {
    wasOpenRef.current = open;
  }, [open]);
  const swapFadeStyle = useAnimatedStyle(
    () => ({ opacity: swapFade.value }),
    [swapFade],
  );

  // The endings hold whatever arrangement they arrive in — a terminal beat
  // never moves the stage geometry. Written during render on purpose: the
  // read below is in the same pass and the write is idempotent.
  const arrangeHoldRef = useRef(false);
  if (shownStep === 'confirm') {
    arrangeHoldRef.current = true;
  } else if (shownStep !== 'success' && shownStep !== 'error') {
    arrangeHoldRef.current = false;
  }
  const compactTarget = arrangeHoldRef.current;
  const replicaOffStage = stagePanelOf(shownStep) !== 'stage';
  // How long this model's screen takes to hand over — the beat every move
  // the stage owns queues behind.
  const swapMs = hardwareDeviceSwapMs(deviceType);

  // What the replica plays. While the arrangement is actually moving the
  // scene holds until the geometry has landed, so the screen's handover
  // never runs while the stage is moving; a step change that keeps the
  // geometry (an ending after confirm) swaps the screen right away.
  const [scene, setScene] = useState(shownStep);
  const sceneCompactRef = useRef(compactTarget);
  // Whether the previous commit had the stage visible — pinned during
  // render so the reappearance frame below can tell itself apart. The
  // stage subtree never unmounts (its native tree is far too heavy to
  // rebuild mid-swap — the rebuild was a long frozen beat); off-stage
  // steps only hide it.
  const stageWasOnRef = useRef(!replicaOffStage);
  const stageAppearing = !replicaOffStage && !stageWasOnRef.current;
  // Adjusted during render (React re-renders before committing): a stage
  // returning to view with the geometry at rest must carry its scene from
  // the first frame — handed the scene a commit later, the screen's
  // entrance starts a beat late, which the crossing pays as dead black.
  // Reappearances landing on a moving arrangement (a panel straight into
  // confirm) keep the lag: geometry first, screen after, per the rule
  // above.
  if (
    stageAppearing &&
    scene !== shownStep &&
    sceneCompactRef.current === compactTarget
  ) {
    setScene(shownStep);
  }
  // The instant-entry grant. An arrival by crossing has the branch fade
  // carry the whole entrance, so the screen must come up already lit —
  // the wake-up ramp would play under that fade as pure black. The grant
  // covers exactly the arrival's own entry: any later step movement
  // retires it (the effect below), so on-stage handovers and cold opens
  // keep the ramp.
  const stageEntryInstantRef = useRef(false);
  const arrivalStepRef = useRef<IDeviceStageStep | undefined>(undefined);
  if (replicaOffStage) {
    stageEntryInstantRef.current = false;
    arrivalStepRef.current = undefined;
  } else if (stageAppearing) {
    stageEntryInstantRef.current = sceneCompactRef.current === compactTarget;
    arrivalStepRef.current = shownStep;
  }
  useEffect(() => {
    stageWasOnRef.current = !replicaOffStage;
  }, [replicaOffStage]);
  useEffect(() => {
    if (arrivalStepRef.current === shownStep) return;
    stageEntryInstantRef.current = false;
  }, [shownStep]);
  useEffect(() => {
    const geometryMoves = sceneCompactRef.current !== compactTarget;
    sceneCompactRef.current = compactTarget;
    if (scene === shownStep) return undefined;
    if (!animated || !geometryMoves) {
      setScene(shownStep);
      return undefined;
    }
    const id = setTimeout(() => setScene(shownStep), ARRANGE_MS);
    return () => clearTimeout(id);
  }, [animated, compactTarget, scene, shownStep]);

  // The words follow the shown step directly — they swap the moment it
  // moves, waiting for neither the arrangement nor the screen's handover.
  // Only the scene lags, and only for the geometry's sake.
  const errorCopy = ERROR_TEXT[errorReason ?? 'generic'];
  const text = shownStep === 'error' ? errorCopy : STEP_TEXT[shownStep];
  const sub = (shownStep === 'confirm' ? confirmContext : text.sub) ?? '';

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
    // After the arrangement and the screen handover have fully finished —
    // the words hold no slot in this queue.
    const delayMs = ARRANGE_MS + swapMs + CARD_IN_GAP_MS;
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
        <YStack pt="$4">
          <Animated.View style={swapFadeStyle}>
            {replicaOffStage ? (
              // Keyed: a panel-to-panel move remounts the whole panel,
              // StepText included, so the words arrive with the panel's
              // fade instead of replaying their own swap on top of it.
              <YStack key={shownStep} gap="$4">
                <StepText title={text.title} sub={sub} animated={animated} />
                {shownStep === 'pinOnApp' ? (
                  <PinPad
                    onSubmit={onPinSubmit}
                    onSwitchToDevice={onSwitchToDevice}
                    error={inputError}
                  />
                ) : null}
                {shownStep === 'passphraseOnApp' ? (
                  <PassphraseForm
                    mode={passphraseMode}
                    onSubmit={onPassphraseSubmit}
                    onSwitchToDevice={onSwitchToDevice}
                    onAttachPin={onPassphraseAttachPin}
                    error={inputError}
                  />
                ) : null}
                {shownStep === 'showQr' ? (
                  <QrPresent value={qrValue} onNext={onQrNext} />
                ) : null}
                {shownStep === 'scanQr' ? (
                  <QrScanFrame onBack={onQrBack} />
                ) : null}
              </YStack>
            ) : null}
            {/* The standing theater. Never unmounted, and parked as an
                invisible overlay rather than display:none — a culled
                subtree still pays its whole native build (mask, blurs,
                gradients) on reveal, a main-thread freeze that held the
                swap black. Parked at opacity zero every view stays built,
                laid out and rasterized, so the reveal is paint-only.
                Absolute keeps it out of the sheet's measured height, and
                its parked frames equal its active ones, so the flip moves
                nothing. */}
            <YStack {...(replicaOffStage ? STAGE_PARKED : undefined)}>
              <Animated.View style={portWindowStyle}>
                <ReplicaPort>
                  {/* What the screen plays comes off the scene map: most steps
                are also the scene the replica plays of them, the endings
                and `off` sit dark, and `processing` borrows the connecting
                wallpaper. */}
                  <Animated.View style={deviceStyle}>
                    <HardwareDevice
                      deviceType={deviceType}
                      animation={SCENE_ANIMATION[scene]}
                      width={REPLICA_WIDTH}
                      instantEntry={stageEntryInstantRef.current}
                    />
                  </Animated.View>
                </ReplicaPort>
              </Animated.View>
              <Animated.View style={textStyle}>
                {/* Snaps while hidden and on the arrival frame — the
                    panel fade carries the words there; the two-phase
                    swap belongs to visible on-stage step changes. */}
                <StepText
                  title={text.title}
                  sub={sub}
                  animated={animated && !replicaOffStage && !stageAppearing}
                />
              </Animated.View>
              {shownStep === 'error' && onErrorAction ? (
                <YStack mt="$5">
                  <Button
                    testID="device-stage-error-action"
                    variant="primary"
                    onPress={onErrorAction}
                  >
                    {errorCopy.action}
                  </Button>
                </YStack>
              ) : null}
              {(shownStep === 'confirm' || shownStep === 'success') &&
              confirmDetails?.length &&
              cardShown ? (
                <Animated.View style={cardStyle}>
                  <YStack
                    mt="$6"
                    borderRadius="$3"
                    bg="rgba(255,255,255,0.06)"
                    px={CARD_OUTDENT}
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
          </Animated.View>
        </YStack>
      </DialogV2>
    </Theme>
  );
}

export type {
  IDeviceStageErrorReason,
  IDeviceStageProps,
  IDeviceStageStep,
} from './type';
