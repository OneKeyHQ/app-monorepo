import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  ThirdPartyWalletAvatarImages,
  getThirdPartyDeviceAvatarImage,
} from '@onekeyhq/shared/src/utils/avatarUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { SCREEN_SWAP_MS, easeOutFn } from '../../content/deviceScene';
import { HardwareDevice } from '../../content/HardwareDevice';
import { LinearGradient } from '../../content/LinearGradient';
import {
  Button,
  Haptics,
  Icon,
  Image,
  ImpactFeedbackStyle,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '../../primitives';
import {
  ARRANGE_MS,
  CARD,
  CARD_IN_START,
  MorphOverlay,
  PILL,
  PILL_OUT_END,
  STAGE_BG,
  arrangeEase,
  stageBgAlpha,
  useMorphOverlay,
} from '../MorphOverlay';

import { PassphraseForm, PinPad } from './AppInputs';
import { AuthChecklist, AuthFailureCard } from './AuthPanels';
import { CardValue } from './CardValue';
import {
  COMPACT_PORT_HEIGHT,
  COMPACT_SCALE,
  PORT_HEIGHT,
  REPLICA_WIDTH,
} from './consts';
import { PassphraseIntro } from './PassphraseIntro';
import { QrPresent, QrScanFrame } from './QrPanels';
import { ShimmerTitle } from './ShimmerTitle';
import {
  COMPACT_STAGED_STEPS,
  DEVICE_BADGE_STEPS,
  ERROR_TEXT,
  FULL_STAGED_STEPS,
  SCENE_ANIMATION,
  STEP_POSE,
  STEP_TEXT,
  resolveBtcHighIndexSub,
  resolveCapsuleText,
  resolveDeviceNotFoundText,
  resolveInstallText,
  resolvePassphrasePanelText,
  resolveStageText,
  resolveStepSub,
} from './stepCopy';
import { StepText, TEXT_OUT_MS } from './StepText';
import {
  InstallChecklist,
  InstallProgress,
  PairingCodeForm,
} from './ThirdPartyPanels';

import type { IDeviceStageProps, IDeviceStageStep } from './type';
import type { IMorphAimFacts } from '../MorphOverlay';
import type { ImageSourcePropType, LayoutChangeEvent } from 'react-native';

/**
 * The device stage: the whole hardware-interaction vocabulary played on
 * one MorphOverlay. The container owns the surface — poses, springs,
 * crossings — and this engine owns what the poses say: words, scenes and
 * panels off the shared vocabulary (./stepCopy), the standing replica,
 * and the per-step flow riding the container's clock through `onAim`.
 *
 * The pose table (./stepCopy's STEP_POSE): `off` is hidden — the stage
 * is simply not there, and entrances appear at their pose; `connecting`
 * and `processing` are capsule-class — waiting beats worn as the
 * flow-spec pill (device thumbnail, sweeping live title, the device's
 * name under it); every other step is card-class, its height hugging
 * that step's own content.
 *
 * The replica is ONE standing device across every pose — the capsule's
 * thumbnail is the same instance worn small, its scenes a troupe parked
 * on one glass (see useSceneTroupe) — and it teleports between its two
 * seats inside the cross-fade gap, where neither pose shows it. Its
 * glass plays the handover between scenes — off, then a wake from
 * black — with arrivals from a hidden device granted instant entry.
 * Inside the stage arrangement the words are StepText swapping in place
 * and the confirm move re-arranges on the arrangement clock; a change
 * of arrangement runs the container's two-phase swap, landing content
 * and height target together on the empty beat; confirm's payload card
 * queues in last. The panels are the scenes' twin troupe (see
 * CARD_ARRANGEMENTS): parked built in their seats, so no crossing or
 * pose flip ever builds native views mid-animation.
 *
 * The stage is modal without a scrim: while it is there the app behind
 * takes no touch — the person stays with the device — and nothing dims
 * (the design leaves the overlay layer off here). Dismissal is the
 * container's (close button, drag, tap outside) behind one grant —
 * `onClose` — that the driver times; see IDeviceStageProps.
 *
 * Still out of scope until ratified: presence in/out for real
 * integration, and accessibility focus.
 */

/** The capsule row, to the design's chip: the connecting-state device —
 * the same replica, worn thumbnail-small — beside a live title over the
 * device's name. The row is the capsule's content, inside the
 * container's own capsule padding (PILL.pad); the row plus that padding
 * is the capsule's measured size. */
const CAPSULE_ROW = {
  /** The content's own inset inside the capsule padding. */
  paddingX: 8,
  /** Thumbnail box the mini replica centers in. */
  thumbBox: 40,
  /** The mini replica's width — the spec's ~25pt device at stage aspect. */
  thumbDeviceWidth: 26,
  /** Gap between the thumbnail and the words. */
  gap: 12,
};

/** The capsule's ratified cap: 288 all in. PILL padding, the row's own
 * inset, the thumb box and the gap leave the words this much — long
 * vendor labels wrap to a second line inside it. */
const CAPSULE_TEXT_MAX_WIDTH =
  288 -
  PILL.pad * 2 -
  CAPSULE_ROW.paddingX * 2 -
  CAPSULE_ROW.thumbBox -
  CAPSULE_ROW.gap;

/** First-frame stand-in for the words block (title, line, the block's
 * own bottom padding), corrected by its first layout report — the
 * card's height target is plain arithmetic over its blocks (see the
 * flow metrics in the component), so only the measured blocks need
 * estimates. */
const WORDS_ESTIMATED_HEIGHT = 72;

/**
 * The panel troupe, the scene troupe's twin on the card side: every
 * arrangement's column is parked built in its own seat and never
 * leaves. Building a panel's native tree (a QR code's whole module
 * matrix, a keypad, a form) is a main-thread burst, and paying it on a
 * crossing's land commit stretched the empty beat, while a pose flip
 * paid a whole-column mount right through the morph spring's most
 * visible frames — so, like the scenes, the builds are paid once each
 * through the overlay's idle and a change only flips which seat is on
 * show. Seats never mount or unmount, which also retires the exit-fade
 * hazard for good (a reanimated exit fade starts at opacity 1, above
 * any faded ancestor — the old relight ghost). The warm-up ladder runs
 * off SCENE_WARM_MS's beat so the two never burst on the same frame.
 */
const CARD_ARRANGEMENTS = [
  'stage',
  'pinOnApp',
  'passphraseIntro',
  'passphraseOnApp',
  'showQr',
  'scanQr',
  'authFailure',
  'error',
  'pairingCode',
  'deviceNotFound',
  'btcHighIndex',
  'installConfirm',
  'installing',
  'installBatch',
] as const;
type ICardArrangement = (typeof CARD_ARRANGEMENTS)[number];
const PANEL_WARM_MS = 475;

/** Confirm's payload card is the stage's last beat: it waits out the
 * arrangement move and the screen handover (the replica's own lit-to-lit
 * beat, see SCREEN_SWAP_MS), then its space lands in one piece — the
 * height spring carries the growth — under an opacity-only fade. */
const CONFIRM_CARD_DELAY_MS = ARRANGE_MS + SCREEN_SWAP_MS + 80;
const CONFIRM_CARD_IN_MS = 320;

/** The confirm card's own inks. The stage is committed dark (STAGE_BG),
 * so the risk colors are its own, not theme tokens — a light theme would
 * otherwise pull the panels out from under the hardcoded white type. */
const CONFIRM_DANGER_BG = 'rgba(255,80,70,0.13)';
const CONFIRM_DANGER_INK = '#FF8D84';

/**
 * The scenes the one standing device can play, every one parked built on
 * its single glass (the troupe grant — see useSceneTroupe). Building a
 * scene's native tree (keypad, masks, gradients) is a main-thread freeze
 * that even a settle-lag could not hide — it read as a dead, dark beat
 * before the screen woke. So the freezes are paid once each, staggered
 * through the overlay's idle after its first show, and a scene change is
 * pure opacity — the handover choreography, never a build. Parked scenes
 * rest on their opening stills (no invisible per-frame work) and a
 * reveal runs the choreography from 0, never mid-loop. `connecting`
 * leads the list: it is the capsule's thumbnail scene, on stage from the
 * first beat, so it ships built with the shell instead of waiting on a
 * warm-up.
 */
const STAGE_SCENES = [
  'connecting',
  'enterPin',
  'enterPassphrase',
  'confirm',
] as const;
type IStageScene = (typeof STAGE_SCENES)[number];
/** Idle beats between the staggered warm-up builds. */
const SCENE_WARM_MS = 350;

/** The capsule's device is the standing replica worn small: the spec's
 * thumbnail width over the stage's own. */
const THUMB_SCALE = CAPSULE_ROW.thumbDeviceWidth / REPLICA_WIDTH;
/** Where along the capsule↔card progress the device teleports between
 * its two seats — inside the cross-fade gap (capsule content is gone by
 * PILL_OUT_END, card content arrives from CARD_IN_START), so the jump is
 * never on screen. */
const SEAT_SWAP_AT = 0.35;
/** First-frame stand-in for the replica's natural height, corrected by
 * its first layout report. */
const DEVICE_ESTIMATED_HEIGHT = 560;

/**
 * The replica layer's opacity floor while the device belongs on stage:
 * at a true 0 iOS evicts the subtree from the compositor, and the next
 * non-zero frame pays the whole replica's first composite again — the
 * capsule->card flight crosses exactly such a gap (the pill-side fade
 * ends at PILL_OUT_END, the staged side only starts at CARD_IN_START),
 * so the repay landed mid-bloom as a one-frame hitch (device-visible;
 * the 2026-08-21 triage). A hair above zero is invisible and keeps the
 * layers alive. Steps that genuinely clear the stage (replicaShown 0)
 * still rest at true 0 and release the memory.
 */
const REPLICA_HOLD_ALPHA = 0.004;

/** The stage fog, painted over the device's foot: the container's face
 * is always opaque STAGE_BG, so a fade derived from the same triplet
 * composites pixel-identically and the morph carries no masked view.
 * Hidden at the thumbnail seat: the capsule wears the whole device,
 * foot and all. */
const FOG_COLORS = [stageBgAlpha(0), stageBgAlpha(0.5), STAGE_BG];
const FOG_LOCATIONS = [0, 0.58, 0.87] as const;

/**
 * Which arrangement a card step gives the standing replica: the full
 * stage for the device-side asks, the miniature for confirm and the
 * authenticity flow, nothing for the app-side inputs, the air-gap pair
 * and the endings. Built off the two staged-step lists so membership is
 * stated once (see ./stepCopy).
 */
const REPLICA_PORT = Object.fromEntries([
  ...FULL_STAGED_STEPS.map((step) => [step, PORT_HEIGHT] as const),
  ...COMPACT_STAGED_STEPS.map((step) => [step, COMPACT_PORT_HEIGHT] as const),
]) as Partial<Record<IDeviceStageStep, number>>;

/** The stage's grouping: the staged steps share one arrangement, every
 * other card step is its own — a crossing between two different
 * arrangements runs the two-phase swap. */
function arrangementOf(step: IDeviceStageStep): string {
  return REPLICA_PORT[step] ? 'stage' : step;
}

/**
 * The staged row, to the design: the replica stands `top` under the
 * content's top edge; on the full stage the words begin `fullHeight`
 * under it — inside the port's fogged foot, the device running on
 * behind them — while the confirm miniature's row ends `bottom` under
 * the scaled device and the words sit clear below.
 */
const STAGE_ROW = {
  top: 16,
  fullHeight: 355,
  bottom: 24,
};
/** Where the replica layer's top sits on the face. */
const REPLICA_TOP = CARD.padTop + STAGE_ROW.top;
/** The words' margin over the spacer, per port: the full stage tucks
 * them into the foot, the miniature clears them. */
function wordsMarginFor(port: number): number {
  return port === PORT_HEIGHT
    ? STAGE_ROW.fullHeight - STAGE_ROW.top - PORT_HEIGHT
    : STAGE_ROW.bottom;
}

const styles = StyleSheet.create({
  // The standing replica, anchored where every staged step seats it; the
  // active column leaves a spacer of its port's height, so the words and
  // panels lay out around a replica they never contain.
  replicaLayer: {
    position: 'absolute',
    top: REPLICA_TOP,
    left: '50%',
    marginLeft: -REPLICA_WIDTH / 2,
    width: REPLICA_WIDTH,
  },
  portWindow: {
    width: REPLICA_WIDTH,
    overflow: 'hidden',
  },
  miniature: {
    transformOrigin: 'top',
  },
  // Full-port geometry, so the fade stays put while the window above
  // animates.
  fog: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: REPLICA_WIDTH,
    height: PORT_HEIGHT,
  },
  fogFill: {
    flex: 1,
  },
  // Above the port the words tuck into.
  wordsBlock: {
    zIndex: 1,
  },
});

/**
 * One warm-up ladder: grow a built-list one member per idle beat, the
 * active member jumping the queue, members never leaving — the shared
 * mechanism behind the panel and scene troupes. `activeDelayMs: 0`
 * builds the active member on the effect's own beat (the panels'
 * shape); a positive delay defers even the queue-jumper (the scenes',
 * pushing a cold build past the springs' settle). Disabled, the ladder
 * holds — the first-show gate in the component.
 */
function useWarmRoster<T extends string>({
  all,
  active,
  initial,
  activeDelayMs,
  idleDelayMs,
  enabled,
}: {
  all: readonly T[];
  active: T | undefined;
  initial?: readonly T[];
  activeDelayMs: number;
  idleDelayMs: number;
  enabled: boolean;
}): T[] {
  const [built, setBuilt] = useState<T[]>(() => (initial ? [...initial] : []));
  useEffect(() => {
    if (!enabled || built.length >= all.length) {
      return undefined;
    }
    const priority = active && !built.includes(active) ? active : undefined;
    const next = priority ?? all.find((name) => !built.includes(name));
    if (!next) {
      return undefined;
    }
    const add = () =>
      setBuilt((current) =>
        current.includes(next) ? current : [...current, next],
      );
    if (priority && activeDelayMs === 0) {
      add();
      return undefined;
    }
    const id = setTimeout(add, priority ? activeDelayMs : idleDelayMs);
    return () => clearTimeout(id);
  }, [active, activeDelayMs, all, built, enabled, idleDelayMs]);
  return built;
}

/**
 * The stage's haptic grammar (expo-haptics maps the same calls onto
 * Android): notification-class for the outcome cards, one impact for
 * the card landing with an ask, the lightest tick for in-card
 * progress. Everything else stays silent — the capsule appearing,
 * returning to it, and the dismissals are attention released, not
 * demanded — matching the system sheets' own restraint. The primitive
 * itself gates every fire on the app's haptics setting, and is a no-op
 * off the phones.
 */
function fireStepHaptic(
  step: IDeviceStageStep,
  arrival: 'landing' | 'crossing',
) {
  // `done` is the one capsule arrival that carries news rather than a
  // wait — the burst's ✓ beat — so it buzzes like the outcome cards.
  if (step === 'authSuccess' || step === 'done') {
    Haptics.success();
    return;
  }
  if (step === 'authFailure' || step === 'error') {
    Haptics.error();
    return;
  }
  if (arrival === 'landing') {
    Haptics.impact(ImpactFeedbackStyle.Medium);
    return;
  }
  Haptics.selection();
}

export function DeviceStage({
  step,
  deviceType,
  deviceName,
  onClose,
  confirmDetails,
  confirmMessage,
  confirmDescription,
  confirmDescriptionDanger,
  confirmCount,
  qrValue,
  onQrNext,
  onQrBack,
  errorReason,
  authChecklist,
  authFailureReason,
  onAuthSupport,
  onAuthRetry,
  onAuthContinueAnyway,
  onErrorAction,
  onPinSubmit,
  onPassphraseIntroContinue,
  passphraseMode,
  onPassphraseSubmit,
  onPassphraseAttachPin,
  onSwitchToDevice,
  inputError,
  vendor,
  vendorModel,
  vendorModelName,
  appName,
  installProgress,
  installQueue,
  installActiveIndex,
  btcHighIndexPath,
  btcHighIndexAccountIndex,
  onPairingSubmit,
  onDeviceNotFoundRetry,
  onBtcHighIndexConfirm,
  onInstallConfirm,
}: IDeviceStageProps) {
  const pose = STEP_POSE[step];
  // While the box is in flight the screen holds still: the triage
  // (2026-08-21) caught the UI thread freezing once per capsule<->card
  // morph, in the flight's own window, scaling with the scene's paint
  // (the Slate's worst) — the incoming scene's first lighting is one
  // large main-thread composite, and paying it mid-flight is the stutter.
  // (A shouldRasterizeIOS freeze was tried first and made it worse: the
  // raster's own on/off each cost a full offscreen pass.) So the pose
  // flight defers the screen handover the way the confirm shrink always
  // has — the scene holds until the geometry has landed (see sceneStep
  // below). Render-phase state write on purpose: the hold must ship in
  // the same commit that starts the springs.
  const [poseInFlight, setPoseInFlight] = useState(false);
  const prevPoseForFlightRef = useRef(pose);
  // Armed by the pose change, consumed by the first settle: the landing
  // haptic must fire exactly once per flight, and the settled signal is
  // level, not edge — at rest every aim pass reports settled again.
  const landingHapticArmedRef = useRef(false);
  if (prevPoseForFlightRef.current !== pose) {
    prevPoseForFlightRef.current = pose;
    landingHapticArmedRef.current = true;
    if (!poseInFlight) {
      setPoseInFlight(true);
    }
  }
  const stepRef = useRef(step);
  stepRef.current = step;
  const handleGeometrySettled = useCallback(() => {
    setPoseInFlight(false);
    if (landingHapticArmedRef.current) {
      landingHapticArmedRef.current = false;
      // Only a card landing speaks — the ask arriving under the hand.
      // An outcome card landing straight off a flight buzzes its news
      // instead of the impact (one haptic per transition). The `done`
      // capsule is the one non-card arrival with news of its own.
      if (STEP_POSE[stepRef.current] === 'card' || stepRef.current === 'done') {
        fireStepHaptic(stepRef.current, 'landing');
      }
    }
  }, []);
  const morph = useMorphOverlay<IDeviceStageStep>({
    value: step,
    pose,
    key: arrangementOf(step),
  });
  const {
    shown: shownStep,
    shownKey: shownArrangement,
    swapFade,
    progress,
    width: morphWidth,
    pillSize,
    reducedMotion,
  } = morph;
  const hidden = pose === 'hidden';

  const shownPort = REPLICA_PORT[shownStep];

  // The in-card progress tick: a card-to-card crossing is the flow
  // moving under the person's eyes (often while they watch the device,
  // not the phone), marked on the swap beat. Pose flights are excluded
  // on both ends — their landing owns the arrival — and capsule label
  // swaps are waits trading places: silent.
  const prevShownForHapticRef = useRef(shownStep);
  useEffect(() => {
    const prev = prevShownForHapticRef.current;
    if (prev === shownStep) {
      return;
    }
    prevShownForHapticRef.current = shownStep;
    if (poseInFlight) {
      return;
    }
    // The `done` capsule buzzes its ✓ even off a capsule label swap —
    // the one non-card arrival that is news, not a wait.
    if (shownStep === 'done') {
      fireStepHaptic(shownStep, 'crossing');
      return;
    }
    if (STEP_POSE[prev] !== 'card' || STEP_POSE[shownStep] !== 'card') {
      return;
    }
    fireStepHaptic(shownStep, 'crossing');
  }, [poseInFlight, shownStep]);
  // A refused entry — inputError arriving — is a failure under the
  // person's fingers: the error buzz in sync with the panel's own
  // refusal beat. Change-driven like the panels' clearing effects, so
  // the driver re-sending the same words is a no-op here too.
  const prevInputErrorRef = useRef(inputError);
  useEffect(() => {
    const prev = prevInputErrorRef.current;
    prevInputErrorRef.current = inputError;
    if (!inputError || inputError === prev) {
      return;
    }
    if (
      stepRef.current === 'pinOnApp' ||
      stepRef.current === 'passphraseOnApp'
    ) {
      Haptics.error();
    }
  }, [inputError]);

  // Which seat the card lights: the last card-class arrangement, frozen
  // through capsule poses so a flip never swaps the fading content
  // mid-exit — the pose window owns that fade, and the parked seats
  // simply hold. Render-time ref write on purpose: the read is in the
  // same pass and the write is idempotent.
  const activeArrangementRef = useRef<ICardArrangement>(
    STEP_POSE[step] === 'card'
      ? (arrangementOf(step) as ICardArrangement)
      : 'stage',
  );
  if (pose === 'card') {
    activeArrangementRef.current = shownArrangement as ICardArrangement;
  }
  const activeArrangement = activeArrangementRef.current;

  // Warm-up starts with the first show: a stage mounted app-wide should
  // cost nothing while no hardware flow has ever opened it. The active
  // arrangement still renders at once (shownPanels includes it), so a
  // first visit that outruns the ladder pays the one cold build it
  // always did. Render-time ref write on purpose, idempotent.
  const everShownRef = useRef(pose !== 'hidden');
  if (pose !== 'hidden') {
    everShownRef.current = true;
  }
  const warmEnabled = everShownRef.current;

  // The troupe's roll-call, the scene warm-up's twin: parked seats never
  // leave, and the active arrangement renders at once even before its
  // warm-up beat.
  const builtPanels = useWarmRoster({
    all: CARD_ARRANGEMENTS,
    active: activeArrangement,
    activeDelayMs: 0,
    idleDelayMs: PANEL_WARM_MS,
    enabled: warmEnabled,
  });
  const shownPanels = useMemo(
    () =>
      CARD_ARRANGEMENTS.filter(
        (name) => name === activeArrangement || builtPanels.includes(name),
      ),
    [activeArrangement, builtPanels],
  );

  // Fresh-visit epochs for the stateful inputs: a parked pad keeps its
  // component state across visits, so each activation signals the clean
  // slate a remount used to provide. Render-time bump, change-guarded.
  const panelEpochsRef = useRef<Partial<Record<ICardArrangement, number>>>({});
  const prevActiveArrangementRef = useRef(activeArrangement);
  if (prevActiveArrangementRef.current !== activeArrangement) {
    prevActiveArrangementRef.current = activeArrangement;
    panelEpochsRef.current[activeArrangement] =
      (panelEpochsRef.current[activeArrangement] ?? 0) + 1;
  }
  const pinEpoch = panelEpochsRef.current.pinOnApp ?? 0;
  const introEpoch = panelEpochsRef.current.passphraseIntro ?? 0;
  const passphraseEpoch = panelEpochsRef.current.passphraseOnApp ?? 0;
  const authFailureEpoch = panelEpochsRef.current.authFailure ?? 0;
  const pairingEpoch = panelEpochsRef.current.pairingCode ?? 0;

  // Every seat reports its own words and tail blocks. The map is what
  // lets a crossing truly land content and height target together: the
  // incoming seat was measured while parked, so the land commit aims at
  // numbers that already exist.
  const [panelMeasures, setPanelMeasures] = useState<
    Partial<Record<ICardArrangement, { words?: number; tail?: number }>>
  >({});
  const reportPanelBlock = useCallback(
    (name: ICardArrangement, block: 'words' | 'tail', blockHeight: number) => {
      setPanelMeasures((current) => {
        const seat = current[name];
        if (seat?.[block] === blockHeight) {
          return current;
        }
        return { ...current, [name]: { ...seat, [block]: blockHeight } };
      });
    },
    [],
  );
  // Every measuring wrapper in this file is a plain react-native View,
  // never a Tamagui Stack: on web, Tamagui's onLayout reads
  // getBoundingClientRect — the rect AFTER ancestor transforms — while
  // RN(-web)'s reads the layout frame. These blocks sit under animated
  // scales (the card's entrance, the thumbnail seat), so only the
  // transform-blind reading matches the native numbers.
  const panelMeasureHandlers = useMemo(() => {
    const handlers = {} as Record<
      ICardArrangement,
      Record<'words' | 'tail', (event: LayoutChangeEvent) => void>
    >;
    for (const name of CARD_ARRANGEMENTS) {
      handlers[name] = {
        words: (event) =>
          reportPanelBlock(
            name,
            'words',
            Math.ceil(event.nativeEvent.layout.height),
          ),
        tail: (event) =>
          reportPanelBlock(
            name,
            'tail',
            Math.ceil(event.nativeEvent.layout.height),
          ),
      };
    }
    return handlers;
  }, [reportPanelBlock]);
  // The replica's natural height, for seating the thumbnail arrangement;
  // scale transforms leave layout alone, so this reports once.
  const [deviceHeight, setDeviceHeight] = useState(DEVICE_ESTIMATED_HEIGHT);
  const handleDeviceLayout = useCallback((event: LayoutChangeEvent) => {
    setDeviceHeight(Math.ceil(event.nativeEvent.layout.height));
  }, []);
  // The staged arrangement's flow metrics: the port window and the words
  // margin animate in layout on the arrangement clock, so the card's
  // height target is plain arithmetic over the blocks — and it moves
  // only when the shown step does: on the empty beat of a crossing, or
  // live inside the stage.
  const spacerTarget = shownPort ? STAGE_ROW.top + shownPort : 0;
  const wordsMarginTarget = shownPort ? wordsMarginFor(shownPort) : 0;
  // While the card is on show `activeArrangement` IS the shown
  // arrangement; under the other poses the card height goes unused.
  const shownPanel = panelMeasures[activeArrangement];
  const shownPanelMeasured =
    shownPanel?.words !== undefined && shownPanel?.tail !== undefined;
  const cardInnerHeight =
    spacerTarget +
    wordsMarginTarget +
    (shownPanel?.words ?? WORDS_ESTIMATED_HEIGHT) +
    (shownPanel?.tail ?? 0);

  // What the replica plays, on the stage's own lag: while the geometry
  // is moving — a pose flight, or the confirm arrangement's port move —
  // the scene holds until it has landed; a change on a resting box hands
  // over right away. The capsule side always plays connecting — the
  // thumbnail IS the connecting-state device.
  const [sceneStep, setSceneStep] = useState(shownStep);
  const scenePortRef = useRef(shownPort);
  useEffect(() => {
    const geometryMoves = Boolean(
      scenePortRef.current && shownPort && scenePortRef.current !== shownPort,
    );
    scenePortRef.current = shownPort;
    if (sceneStep === shownStep) return undefined;
    if (reducedMotion) {
      setSceneStep(shownStep);
      return undefined;
    }
    // A pose flight ends with the settled signal, and this effect re-runs
    // on the flag's fall — the handover starts the moment the box rests.
    if (poseInFlight) return undefined;
    if (!geometryMoves) {
      setSceneStep(shownStep);
      return undefined;
    }
    const id = setTimeout(() => setSceneStep(shownStep), ARRANGE_MS);
    return () => clearTimeout(id);
  }, [poseInFlight, reducedMotion, sceneStep, shownPort, shownStep]);
  // The glass follows the HELD step, not the live pose: during a pose
  // flight (either direction) it keeps playing what it was playing, and
  // the handover — the one expensive first lighting — always lands on a
  // resting box. Held card steps play their own screens (off-stage card
  // steps map to no scene — dark); everything else is the connecting
  // device, the capsule's own face.
  let activeScene: IStageScene | undefined = 'connecting';
  if (STEP_POSE[sceneStep] === 'card') {
    activeScene = SCENE_ANIMATION[sceneStep] as IStageScene | undefined;
  }
  // The instant-entry grant: an arrival whose reveal the presenter
  // carries (the device coming back from a step that hid it, or the
  // shell's entrance) lands already lit — a wake ramp under that fade
  // would play as dead black. The grant covers exactly the arrival's own
  // entry: any later step movement retires it, so handovers on glass
  // that stayed in view keep the ramp. Render-time ref writes on
  // purpose: the reads are in the same pass and the writes idempotent.
  const deviceOnShow = pose === 'capsule' || Boolean(shownPort);
  const deviceWasOnShowRef = useRef(deviceOnShow);
  const entryInstantRef = useRef(false);
  const arrivalStepRef = useRef<IDeviceStageStep | undefined>(undefined);
  if (!deviceOnShow) {
    entryInstantRef.current = false;
    arrivalStepRef.current = undefined;
  } else if (!deviceWasOnShowRef.current) {
    entryInstantRef.current = true;
    arrivalStepRef.current = shownStep;
  }
  const sceneEntryInstant = entryInstantRef.current;
  useEffect(() => {
    deviceWasOnShowRef.current = deviceOnShow;
  }, [deviceOnShow]);
  useEffect(() => {
    if (arrivalStepRef.current === shownStep) return;
    entryInstantRef.current = false;
  }, [shownStep]);
  // The scene troupe's warm-up: one scene built per idle beat, the
  // current step's own scene jumping the queue past the springs' settle.
  // The connecting scene is born built: the capsule needs it from the
  // first frame.
  const builtScenes = useWarmRoster({
    all: STAGE_SCENES,
    active: activeScene,
    initial: ['connecting'],
    activeDelayMs: 600,
    idleDelayMs: SCENE_WARM_MS,
    enabled: warmEnabled,
  });

  // Confirm's payload card, the last beat: mounted late so its space
  // lands in one piece (the height spring carries the growth), faded in
  // alone once the geometry and the screen handover are done. Any of the
  // three content shapes summons it; the count pill rides its beat, it
  // never calls the card up alone.
  const hasConfirmContent = Boolean(
    confirmDetails?.length || confirmMessage || confirmDescription,
  );
  const [confirmCardShown, setConfirmCardShown] = useState(false);
  const confirmCardIn = useSharedValue(0);
  useEffect(() => {
    if (shownStep !== 'confirm' || !hasConfirmContent) {
      setConfirmCardShown(false);
      confirmCardIn.value = 0;
      return undefined;
    }
    if (reducedMotion) {
      setConfirmCardShown(true);
      confirmCardIn.value = 1;
      return undefined;
    }
    const id = setTimeout(() => {
      confirmCardIn.value = 0;
      setConfirmCardShown(true);
      confirmCardIn.value = withTiming(1, {
        duration: CONFIRM_CARD_IN_MS,
        easing: easeOutFn,
      });
    }, CONFIRM_CARD_DELAY_MS);
    return () => clearTimeout(id);
  }, [confirmCardIn, hasConfirmContent, reducedMotion, shownStep]);

  // The stage's own flow, aimed on the container's clock through onAim:
  // the replica gate, the staged port and miniature scale, and the
  // column's spacer and words margin. The miniature's scale is the
  // port's own fact — the compact port IS the scaled replica — so one
  // derivation replaces a second step list.
  const replicaShown = useSharedValue(shownPort ? 1 : 0);
  const portHeight = useSharedValue(shownPort ?? PORT_HEIGHT);
  const deviceScale = useSharedValue(
    shownPort === COMPACT_PORT_HEIGHT ? COMPACT_SCALE : 1,
  );
  const spacerHeight = useSharedValue(spacerTarget);
  const wordsMargin = useSharedValue(wordsMarginTarget);
  const scaleTarget = shownPort === COMPACT_PORT_HEIGHT ? COMPACT_SCALE : 1;
  const handleAim = useCallback(
    (facts: IMorphAimFacts) => {
      // The gate lands in one piece — the branch fades (swapFade and the
      // pose windows) carry the replica's actual visibility.
      replicaShown.value = shownPort ? 1 : 0;
      if (facts.snap) {
        spacerHeight.value = spacerTarget;
        wordsMargin.value = wordsMarginTarget;
        if (shownPort) {
          portHeight.value = shownPort;
          deviceScale.value = scaleTarget;
        }
        return;
      }
      // A hidden replica holds its last arrangement instead of animating
      // offstage, so it re-enters exactly as it left — which also means
      // the arrangement it left in may not be the one it returns to.
      // Like the flow twins below, the pair lands the new arrangement in
      // one piece on a crossing or a pose arrival (otherwise a stale
      // confirm miniature grows to full size under the reveal); only a
      // live stage move — the confirm shrink and back, on show — runs on
      // the clock.
      if (shownPort) {
        if (facts.landInPlace) {
          portHeight.value = shownPort;
          deviceScale.value = scaleTarget;
        } else {
          portHeight.value = withTiming(shownPort, {
            duration: ARRANGE_MS,
            easing: arrangeEase,
          });
          deviceScale.value = withTiming(scaleTarget, {
            duration: ARRANGE_MS,
            easing: arrangeEase,
          });
        }
      }
      // The column's flow twins: they land in one piece with a
      // (re)mounted column — a pose arrival or an arrangement crossing —
      // and move on the arrangement clock inside the stage.
      if (facts.card) {
        if (facts.landInPlace) {
          spacerHeight.value = spacerTarget;
          wordsMargin.value = wordsMarginTarget;
        } else {
          spacerHeight.value = withTiming(spacerTarget, {
            duration: ARRANGE_MS,
            easing: arrangeEase,
          });
          wordsMargin.value = withTiming(wordsMarginTarget, {
            duration: ARRANGE_MS,
            easing: arrangeEase,
          });
        }
      }
    },
    [
      deviceScale,
      portHeight,
      replicaShown,
      scaleTarget,
      shownPort,
      spacerHeight,
      spacerTarget,
      wordsMargin,
      wordsMarginTarget,
    ],
  );

  // The one device's two seats, all decided by where `progress` stands
  // relative to the teleport point — a UI-thread step function, so the
  // jump lands mid-flight frame-exactly, inside the cross-fade gap. On
  // the capsule side the layer wears the pill's own fade window and
  // shifts up to the face top; on the staged side it wears the replica
  // fade gated by the card's arrival window, so a reveal racing the
  // teleport can never show the device at the wrong seat.
  const pillHeight = pillSize.height;
  const replicaLayerStyle = useAnimatedStyle(() => {
    if (progress.value < SEAT_SWAP_AT) {
      return {
        opacity: Math.max(
          interpolate(
            progress.value,
            [0, PILL_OUT_END],
            [1, 0],
            Extrapolation.CLAMP,
          ),
          REPLICA_HOLD_ALPHA,
        ),
        transform: [{ translateY: -REPLICA_TOP }],
      };
    }
    const staged =
      replicaShown.value *
      swapFade.value *
      interpolate(
        progress.value,
        [CARD_IN_START, 1],
        [0, 1],
        Extrapolation.CLAMP,
      );
    return {
      // The floor only while the device belongs on stage — an off-stage
      // step's 0 stays 0, so its layer is really released.
      opacity:
        replicaShown.value === 0
          ? staged
          : Math.max(staged, REPLICA_HOLD_ALPHA),
      transform: [{ translateY: 0 }],
    };
  }, [progress, replicaShown, swapFade]);
  // At the thumbnail seat the window opens to the capsule's own height —
  // nothing to crop, the whole device is on show.
  const portWindowStyle = useAnimatedStyle(
    () => ({
      height: progress.value < SEAT_SWAP_AT ? pillHeight : portHeight.value,
    }),
    [pillHeight, portHeight, progress],
  );
  const deviceSeatStyle = useAnimatedStyle(() => {
    if (progress.value < SEAT_SWAP_AT) {
      // Centered in the thumbnail box at the row's start, in port
      // coordinates (the layer shift above pins the port to the face
      // top): translate in parent units, then shrink about top-center.
      return {
        transform: [
          {
            translateX:
              PILL.pad +
              CAPSULE_ROW.paddingX +
              CAPSULE_ROW.thumbBox / 2 -
              morphWidth.value / 2,
          },
          {
            translateY: pillHeight / 2 - (deviceHeight * THUMB_SCALE) / 2,
          },
          { scale: THUMB_SCALE },
        ],
      };
    }
    return {
      transform: [
        { translateX: 0 },
        { translateY: 0 },
        { scale: deviceScale.value },
      ],
    };
  }, [deviceHeight, deviceScale, morphWidth, pillHeight, progress]);
  // The fog belongs to the stage seats only: the capsule wears the whole
  // device, foot and all.
  const fogMotionStyle = useAnimatedStyle(
    () => ({ opacity: progress.value < SEAT_SWAP_AT ? 0 : 1 }),
    [progress],
  );
  const spacerFlowStyle = useAnimatedStyle(
    () => ({ height: spacerHeight.value }),
    [spacerHeight],
  );
  const wordsFlowStyle = useAnimatedStyle(
    () => ({ marginTop: wordsMargin.value }),
    [wordsMargin],
  );
  const confirmCardStyle = useAnimatedStyle(
    () => ({ opacity: confirmCardIn.value }),
    [confirmCardIn],
  );

  const replicaStyle = useMemo(
    () => [styles.replicaLayer, replicaLayerStyle],
    [replicaLayerStyle],
  );
  const portStyle = useMemo(
    () => [styles.portWindow, portWindowStyle],
    [portWindowStyle],
  );
  const deviceStyle = useMemo(
    () => [styles.miniature, deviceSeatStyle],
    [deviceSeatStyle],
  );
  const fogStyle = useMemo(
    () => [styles.fog, fogMotionStyle],
    [fogMotionStyle],
  );
  const wordsStyle = useMemo(
    () => [styles.wordsBlock, wordsFlowStyle],
    [wordsFlowStyle],
  );

  // Each seat's words, straight off the shared vocabulary. The stage
  // seat speaks for whichever staged step is (or last was) on show —
  // tracked off the live step, so a parked stage snaps its words during
  // the out beat and the land reveals them already true; a crossing's
  // outgoing side keeps its own words because its seat simply is not
  // the one changing. App seats own their words outright; the pieces
  // that vary (the passphrase title, the error copy) snap while parked,
  // as StepText animates on the active seat alone.
  const errorCopy = ERROR_TEXT[errorReason ?? 'generic'];
  const stageWordsRef = useRef<IDeviceStageStep>(
    REPLICA_PORT[step] ? step : 'enterPin',
  );
  if (REPLICA_PORT[step]) {
    stageWordsRef.current = step;
  }
  const stageWordsStep = stageWordsRef.current;
  const stageText = resolveStageText(stageWordsStep);
  const passphraseText = resolvePassphrasePanelText(passphraseMode);
  const appStepSub = useMemo(
    () => ({
      pinOnApp: resolveStepSub('pinOnApp'),
      showQr: resolveStepSub('showQr'),
      scanQr: resolveStepSub('scanQr'),
    }),
    [],
  );
  // The third-party cards' runtime words: brand, app name, path.
  const deviceNotFoundText = useMemo(
    () => resolveDeviceNotFoundText(vendor),
    [vendor],
  );
  const btcHighIndexSub = useMemo(
    () => resolveBtcHighIndexSub(btcHighIndexPath, btcHighIndexAccountIndex),
    [btcHighIndexAccountIndex, btcHighIndexPath],
  );
  const installConfirmText = useMemo(
    () => resolveInstallText('installConfirm', appName),
    [appName],
  );
  const installingText = useMemo(
    () => resolveInstallText('installing', appName),
    [appName],
  );
  // The capsule's vendor seat: the model's product shot off the shared
  // avatar mapping, brand-generic fallback when the model is unknown —
  // never the wrong brand.
  const vendorImageSource = useMemo(() => {
    if (!vendor) {
      return undefined;
    }
    const key = getThirdPartyDeviceAvatarImage({
      vendor:
        vendor === 'ledger' ? EHardwareVendor.ledger : EHardwareVendor.trezor,
      vendorModel,
      vendorModelName,
      fallback: vendor === 'ledger' ? 'LedgerNanoX' : 'TrezorSafe7',
    });
    // The avatar table's values are bare require() results (untyped).
    return ThirdPartyWalletAvatarImages[key] as ImageSourcePropType;
  }, [vendor, vendorModel, vendorModelName]);
  const stageAnimated = activeArrangement === 'stage' && !reducedMotion;
  const passphraseAnimated =
    activeArrangement === 'passphraseOnApp' && !reducedMotion;
  const errorAnimated = activeArrangement === 'error' && !reducedMotion;
  // The tail's checklist rides the words' own beat. On a live in-stage
  // change the words land at the end of StepText's out phase, while a
  // mounting tail would report its height on the very next frame — two
  // re-aims, and the box visibly heads for the interim target before
  // doubling back. Flipping the checklist on the words' clock lands
  // both measures together, so the height re-aims once, straight at
  // the final height. Non-animated paths (a parked seat, reduced
  // motion) snap in sync already.
  const wantStageChecklist =
    (stageWordsStep === 'authVerifying' || stageWordsStep === 'authSuccess') &&
    Boolean(authChecklist?.length);
  const [stageChecklistShown, setStageChecklistShown] =
    useState(wantStageChecklist);
  useEffect(() => {
    if (stageChecklistShown === wantStageChecklist) return undefined;
    if (!stageAnimated) {
      setStageChecklistShown(wantStageChecklist);
      return undefined;
    }
    const id = setTimeout(
      () => setStageChecklistShown(wantStageChecklist),
      TEXT_OUT_MS,
    );
    return () => clearTimeout(id);
  }, [stageAnimated, stageChecklistShown, wantStageChecklist]);
  // The capsule keeps its own last words while another pose plays, so
  // the (invisible) row never re-measures against a card title and the
  // size springs always aim at true capsule content. Render-time ref
  // write on purpose: the read is in the same pass and the write is
  // idempotent.
  const capsuleTextRef = useRef(
    resolveCapsuleText('connecting', deviceName, vendor),
  );
  // The capsule's glyph seat freezes on the same clock as its words: the
  // vendor's product shot for the device beats, the ✓ for `done`.
  const capsuleGlyphRef = useRef<'device' | 'done'>('device');
  if (pose === 'capsule') {
    // Straight off the live step: the column's words freeze on card
    // steps, but the capsule always speaks the present.
    capsuleTextRef.current = resolveCapsuleText(step, deviceName, vendor);
    capsuleGlyphRef.current = vendor && step === 'done' ? 'done' : 'device';
  }
  const capsuleText = capsuleTextRef.current;
  const capsuleGlyph = capsuleGlyphRef.current;

  /* The parked columns, one per arrangement — each element memoized on
   * its own inputs, so a step change re-renders only the seats it
   * touched and every other parked column bails by identity. */
  const stagePanel = useMemo(
    () => (
      <YStack>
        <Animated.View style={spacerFlowStyle} />
        <Animated.View style={wordsStyle}>
          <View onLayout={panelMeasureHandlers.stage.words}>
            <XStack ai="flex-start" jc="space-between" gap="$3">
              <Stack flexShrink={1}>
                <StepText
                  title={stageText.title}
                  sub={stageText.sub}
                  animated={stageAnimated}
                />
              </Stack>
              {/* The count pill — this burst's place in a run — arrives
                  on the payload card's own beat and fade, so the title
                  and its furniture land together. */}
              {confirmCount && confirmCardShown ? (
                <Animated.View style={confirmCardStyle}>
                  <Stack
                    borderRadius="$full"
                    borderWidth={1}
                    borderColor="rgba(255,255,255,0.18)"
                    px="$2.5"
                    py="$0.5"
                    mt="$1"
                  >
                    <SizableText size="$bodySm" color="rgba(255,255,255,0.85)">
                      {`${confirmCount.current} / ${confirmCount.total}`}
                    </SizableText>
                  </Stack>
                </Animated.View>
              ) : null}
            </XStack>
          </View>
        </Animated.View>
        <View onLayout={panelMeasureHandlers.stage.tail}>
          {/* The authenticity checklist rides the staged words the way
              confirm's payload card does — under them, on the same
              surface, its rows advanced by the driver; its presence
              flips on the words' beat (see stageChecklistShown). */}
          {stageChecklistShown && authChecklist?.length ? (
            <AuthChecklist items={authChecklist} />
          ) : null}
          {confirmCardShown ? (
            <Animated.View style={confirmCardStyle}>
              <YStack
                borderRadius="$6"
                borderCurve="continuous"
                bg={confirmDescriptionDanger ? CONFIRM_DANGER_BG : '$neutral4'}
                px="$4"
                py="$3"
                gap="$3"
              >
                {confirmDetails?.map((row) => (
                  <YStack key={row.label} gap="$1">
                    <SizableText size="$bodySm" color="rgba(255,255,255,0.5)">
                      {row.label}
                    </SizableText>
                    <CardValue
                      value={row.value}
                      highlightEnds={row.highlightEnds}
                      warning={row.warning}
                    />
                  </YStack>
                ))}
                {confirmMessage ? (
                  <SizableText
                    fontFamily="$monoMedium"
                    fontSize={13}
                    lineHeight={21}
                    color="rgba(255,255,255,0.85)"
                    numberOfLines={5}
                  >
                    {confirmMessage}
                  </SizableText>
                ) : null}
                {confirmDescription ? (
                  <SizableText
                    size="$bodyMd"
                    color={
                      confirmDescriptionDanger
                        ? CONFIRM_DANGER_INK
                        : 'rgba(255,255,255,0.85)'
                    }
                  >
                    {confirmDescription}
                  </SizableText>
                ) : null}
              </YStack>
            </Animated.View>
          ) : null}
        </View>
      </YStack>
    ),
    [
      authChecklist,
      confirmCardShown,
      confirmCardStyle,
      confirmCount,
      confirmDescription,
      confirmDescriptionDanger,
      confirmDetails,
      confirmMessage,
      panelMeasureHandlers,
      spacerFlowStyle,
      stageAnimated,
      stageChecklistShown,
      stageText,
      wordsStyle,
    ],
  );
  const pinPanel = useMemo(
    () => (
      <YStack>
        <View onLayout={panelMeasureHandlers.pinOnApp.words}>
          <StepText
            title={STEP_TEXT.pinOnApp.title}
            sub={appStepSub.pinOnApp}
            animated={false}
          />
        </View>
        <View onLayout={panelMeasureHandlers.pinOnApp.tail}>
          {/* A vendor pinOnApp is the Trezor matrix by definition (Ledger
              never asks the app for a PIN): nine positions, and no
              on-device switch — the button devices that reach this step
              cannot take the PIN themselves, whatever the driver wires. */}
          <PinPad
            onSubmit={onPinSubmit}
            onSwitchToDevice={vendor ? undefined : onSwitchToDevice}
            error={inputError}
            resetSignal={pinEpoch}
            noZeroKey={Boolean(vendor)}
          />
        </View>
      </YStack>
    ),
    [
      appStepSub.pinOnApp,
      inputError,
      onPinSubmit,
      onSwitchToDevice,
      panelMeasureHandlers,
      pinEpoch,
      vendor,
    ],
  );
  const passphraseIntroPanel = useMemo(
    () => (
      <YStack>
        <View onLayout={panelMeasureHandlers.passphraseIntro.words}>
          <StepText
            title={STEP_TEXT.passphraseIntro.title}
            sub=""
            animated={false}
          />
        </View>
        <View onLayout={panelMeasureHandlers.passphraseIntro.tail}>
          <PassphraseIntro
            onContinue={onPassphraseIntroContinue}
            resetSignal={introEpoch}
          />
        </View>
      </YStack>
    ),
    [introEpoch, onPassphraseIntroContinue, panelMeasureHandlers],
  );
  const passphrasePanel = useMemo(
    () => (
      <YStack>
        <View onLayout={panelMeasureHandlers.passphraseOnApp.words}>
          <StepText
            title={passphraseText.title}
            sub={passphraseText.sub}
            animated={passphraseAnimated}
          />
        </View>
        <View onLayout={panelMeasureHandlers.passphraseOnApp.tail}>
          {/* The attach-PIN exit is OneKey firmware's own feature — no
              vendor device has it, whatever the driver wires. On-device
              entry stays: Trezor supports it. */}
          <PassphraseForm
            mode={passphraseMode}
            onSubmit={onPassphraseSubmit}
            onSwitchToDevice={onSwitchToDevice}
            onAttachPin={vendor ? undefined : onPassphraseAttachPin}
            error={inputError}
            resetSignal={passphraseEpoch}
          />
        </View>
      </YStack>
    ),
    [
      inputError,
      onPassphraseAttachPin,
      onPassphraseSubmit,
      onSwitchToDevice,
      panelMeasureHandlers,
      passphraseAnimated,
      passphraseEpoch,
      passphraseMode,
      passphraseText,
      vendor,
    ],
  );
  const showQrPanel = useMemo(
    () => (
      <YStack>
        <View onLayout={panelMeasureHandlers.showQr.words}>
          <StepText
            title={STEP_TEXT.showQr.title}
            sub={appStepSub.showQr}
            animated={false}
          />
        </View>
        <View onLayout={panelMeasureHandlers.showQr.tail}>
          <QrPresent value={qrValue} onNext={onQrNext} />
        </View>
      </YStack>
    ),
    [appStepSub.showQr, onQrNext, panelMeasureHandlers, qrValue],
  );
  const scanQrPanel = useMemo(
    () => (
      <YStack>
        <View onLayout={panelMeasureHandlers.scanQr.words}>
          <StepText
            title={STEP_TEXT.scanQr.title}
            sub={appStepSub.scanQr}
            animated={false}
          />
        </View>
        <View onLayout={panelMeasureHandlers.scanQr.tail}>
          <QrScanFrame onBack={onQrBack} />
        </View>
      </YStack>
    ),
    [appStepSub.scanQr, onQrBack, panelMeasureHandlers],
  );
  const authFailurePanel = useMemo(
    () => (
      <YStack>
        {/* The card fronts its icon above its own words, NOTE beat
            included, so the whole column is the words block; the tail
            stands empty. */}
        <View onLayout={panelMeasureHandlers.authFailure.words}>
          <AuthFailureCard
            reason={authFailureReason}
            checklist={authChecklist}
            onSupport={onAuthSupport}
            onRetry={onAuthRetry}
            onContinueAnyway={onAuthContinueAnyway}
            resetSignal={authFailureEpoch}
          />
        </View>
        <View onLayout={panelMeasureHandlers.authFailure.tail} />
      </YStack>
    ),
    [
      authChecklist,
      authFailureEpoch,
      authFailureReason,
      onAuthContinueAnyway,
      onAuthRetry,
      onAuthSupport,
      panelMeasureHandlers,
    ],
  );
  const errorPanel = useMemo(
    () => (
      <YStack>
        <View onLayout={panelMeasureHandlers.error.words}>
          <StepText
            title={errorCopy.title}
            sub={errorCopy.sub}
            animated={errorAnimated}
          />
        </View>
        <View onLayout={panelMeasureHandlers.error.tail}>
          {onErrorAction ? (
            <Button
              testID="device-stage-error-action"
              variant="primary"
              onPress={onErrorAction}
            >
              {errorCopy.action}
            </Button>
          ) : null}
        </View>
      </YStack>
    ),
    [errorAnimated, errorCopy, onErrorAction, panelMeasureHandlers],
  );
  const pairingCodePanel = useMemo(
    () => (
      <YStack>
        <View onLayout={panelMeasureHandlers.pairingCode.words}>
          <StepText
            title={STEP_TEXT.pairingCode.title}
            sub={STEP_TEXT.pairingCode.sub ?? ''}
            animated={false}
          />
        </View>
        <View onLayout={panelMeasureHandlers.pairingCode.tail}>
          <PairingCodeForm
            onSubmit={onPairingSubmit}
            resetSignal={pairingEpoch}
          />
        </View>
      </YStack>
    ),
    [onPairingSubmit, pairingEpoch, panelMeasureHandlers],
  );
  const deviceNotFoundPanel = useMemo(
    () => (
      <YStack>
        <View onLayout={panelMeasureHandlers.deviceNotFound.words}>
          <StepText
            title={deviceNotFoundText.title}
            sub={deviceNotFoundText.sub}
            animated={false}
          />
        </View>
        <View onLayout={panelMeasureHandlers.deviceNotFound.tail}>
          {onDeviceNotFoundRetry ? (
            <Button
              testID="device-stage-device-not-found-confirm"
              variant="primary"
              size="large"
              onPress={onDeviceNotFoundRetry}
            >
              Confirm
            </Button>
          ) : null}
        </View>
      </YStack>
    ),
    [deviceNotFoundText, onDeviceNotFoundRetry, panelMeasureHandlers],
  );
  const btcHighIndexPanel = useMemo(
    () => (
      <YStack>
        <View onLayout={panelMeasureHandlers.btcHighIndex.words}>
          <StepText
            title={STEP_TEXT.btcHighIndex.title}
            sub={btcHighIndexSub}
            animated={false}
          />
        </View>
        <View onLayout={panelMeasureHandlers.btcHighIndex.tail}>
          {onBtcHighIndexConfirm ? (
            <Button
              testID="device-stage-btc-high-index-confirm"
              variant="primary"
              size="large"
              onPress={onBtcHighIndexConfirm}
            >
              Confirm
            </Button>
          ) : null}
        </View>
      </YStack>
    ),
    [btcHighIndexSub, onBtcHighIndexConfirm, panelMeasureHandlers],
  );
  const installConfirmPanel = useMemo(
    () => (
      <YStack>
        <View onLayout={panelMeasureHandlers.installConfirm.words}>
          <StepText
            title={installConfirmText.title}
            sub={installConfirmText.sub}
            animated={false}
          />
        </View>
        <View onLayout={panelMeasureHandlers.installConfirm.tail}>
          {onInstallConfirm ? (
            <Button
              testID="device-stage-install-confirm"
              variant="primary"
              size="large"
              onPress={onInstallConfirm}
            >
              Install
            </Button>
          ) : null}
        </View>
      </YStack>
    ),
    [installConfirmText, onInstallConfirm, panelMeasureHandlers],
  );
  const installingPanel = useMemo(
    () => (
      <YStack>
        <View onLayout={panelMeasureHandlers.installing.words}>
          <StepText
            title={installingText.title}
            sub={installingText.sub}
            animated={false}
          />
        </View>
        <View onLayout={panelMeasureHandlers.installing.tail}>
          <InstallProgress appName={appName} percent={installProgress} />
        </View>
      </YStack>
    ),
    [appName, installProgress, installingText, panelMeasureHandlers],
  );
  const installBatchPanel = useMemo(
    () => (
      <YStack>
        <View onLayout={panelMeasureHandlers.installBatch.words}>
          <StepText
            title={STEP_TEXT.installBatch.title}
            sub={STEP_TEXT.installBatch.sub ?? ''}
            animated={false}
          />
        </View>
        <View onLayout={panelMeasureHandlers.installBatch.tail}>
          {installQueue?.length ? (
            <InstallChecklist
              queue={installQueue}
              activeIndex={installActiveIndex}
              percent={installProgress}
            />
          ) : null}
        </View>
      </YStack>
    ),
    [installActiveIndex, installProgress, installQueue, panelMeasureHandlers],
  );
  const panelByArrangement: Record<ICardArrangement, ReactNode> = useMemo(
    () => ({
      stage: stagePanel,
      pinOnApp: pinPanel,
      passphraseIntro: passphraseIntroPanel,
      passphraseOnApp: passphrasePanel,
      showQr: showQrPanel,
      scanQr: scanQrPanel,
      authFailure: authFailurePanel,
      error: errorPanel,
      pairingCode: pairingCodePanel,
      deviceNotFound: deviceNotFoundPanel,
      btcHighIndex: btcHighIndexPanel,
      installConfirm: installConfirmPanel,
      installing: installingPanel,
      installBatch: installBatchPanel,
    }),
    [
      authFailurePanel,
      btcHighIndexPanel,
      deviceNotFoundPanel,
      errorPanel,
      installBatchPanel,
      installConfirmPanel,
      installingPanel,
      pairingCodePanel,
      passphraseIntroPanel,
      passphrasePanel,
      pinPanel,
      scanQrPanel,
      showQrPanel,
      stagePanel,
    ],
  );
  const seats = useMemo(
    () =>
      shownPanels.map((name) => ({
        key: name,
        active: name === activeArrangement,
        node: panelByArrangement[name],
      })),
    [activeArrangement, panelByArrangement, shownPanels],
  );

  // The deepest subtree on stage, held by identity: unrelated re-renders
  // (measure reports, capsule words, warm-up beats) reuse the element,
  // so React skips reconciling the whole shell. Everything that must
  // reach the device is a dependency, so a real change still rebuilds.
  const deviceLayer = useMemo(
    () => (
      <View onLayout={handleDeviceLayout}>
        <HardwareDevice
          deviceType={deviceType ?? 'unknown'}
          animation={activeScene}
          warmScenes={builtScenes}
          width={REPLICA_WIDTH}
          instantEntry={sceneEntryInstant}
          paused={hidden}
        />
      </View>
    ),
    [
      activeScene,
      builtScenes,
      deviceType,
      handleDeviceLayout,
      hidden,
      sceneEntryInstant,
    ],
  );

  // The standing set: ONE device across every pose, never rebuilt, only
  // re-seated — thumbnail-small beside the capsule's words, the full
  // stage or the confirm miniature on the card. Its scenes live parked
  // on its one glass (the troupe grant): a crossing flips which is lit
  // and nothing ever builds; only the visible scene's clock runs, from
  // 0. The fog paints the port fade over the opaque face, and rests
  // while the capsule wears the whole device.
  const stageLayer = useMemo(
    () => (
      <Animated.View style={replicaStyle} pointerEvents="none">
        <Animated.View style={portStyle}>
          <Animated.View style={deviceStyle}>{deviceLayer}</Animated.View>
          <Animated.View style={fogStyle}>
            <LinearGradient
              colors={FOG_COLORS}
              locations={FOG_LOCATIONS}
              style={styles.fogFill}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    ),
    [deviceLayer, deviceStyle, fogStyle, portStyle, replicaStyle],
  );

  const capsule = useMemo(
    () => (
      <XStack
        px={CAPSULE_ROW.paddingX}
        gap={CAPSULE_ROW.gap}
        alignItems="center"
      >
        {/* The device's capsule seat, held open: the one standing replica
          wears the thumbnail arrangement over this box — the
          connecting-state device itself, never a second instance.
          Living outside the keyed row, it also never rebuilds when the
          capsule's words swap. The vendor track fills the same box
          itself — a product shot, or the ✓ on `done` — since those
          devices have no replica to seat here. */}
        <Stack
          width={CAPSULE_ROW.thumbBox}
          height={CAPSULE_ROW.thumbBox}
          alignItems="center"
          justifyContent="center"
        >
          {capsuleGlyph === 'done' ? (
            <Icon name="CheckRadioSolid" size="$6" color="$iconSuccess" />
          ) : null}
          {capsuleGlyph === 'device' && vendorImageSource ? (
            <Image
              source={vendorImageSource}
              width={CAPSULE_ROW.thumbBox}
              height={CAPSULE_ROW.thumbBox}
            />
          ) : null}
        </Stack>
        <YStack maxWidth={CAPSULE_TEXT_MAX_WIDTH}>
          {/* The sweep rests with the capsule: hidden poses neither pay
            its per-frame band nor resume it mid-glide. */}
          <ShimmerTitle paused={pose !== 'capsule'}>
            {capsuleText.title}
          </ShimmerTitle>
          {capsuleText.sub ? (
            <SizableText size="$bodyMd" color="$textSubdued">
              {capsuleText.sub}
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
    ),
    [capsuleGlyph, capsuleText, pose, vendorImageSource],
  );

  // The card's corner badge: the device's name at the top left, the
  // close button's mirror — worn only by the device-side steps, where
  // the person must reach for the physical device the badge names.
  const cornerBadge = useMemo(() => {
    if (!deviceName || !DEVICE_BADGE_STEPS.has(shownStep)) {
      return null;
    }
    return (
      <Stack borderRadius="$full" bg="$neutral4" px="$2.5" py="$1">
        <SizableText size="$bodySm" color="$textSubdued">
          {deviceName}
        </SizableText>
      </Stack>
    );
  }, [deviceName, shownStep]);

  return (
    <MorphOverlay
      morph={morph}
      cardInnerHeight={cardInnerHeight}
      cardContentMeasured={shownPanelMeasured}
      heightArrangeToken={shownPort}
      onAim={handleAim}
      onDismiss={onClose}
      onGeometrySettled={handleGeometrySettled}
      modal
      capsuleKey={capsuleText.title}
      capsule={capsule}
      cornerBadge={cornerBadge}
      stageLayer={stageLayer}
      seats={seats}
    />
  );
}

export type {
  IAuthChecklistItem,
  IAuthFailureReason,
  IDeviceStageErrorReason,
  IDeviceStageProps,
  IDeviceStageStep,
} from './type';
