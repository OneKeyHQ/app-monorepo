import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { SCREEN_SWAP_MS, easeOutFn } from '../../content/deviceScene';
import { HardwareDevice } from '../../content/HardwareDevice';
import { LinearGradient } from '../../content/LinearGradient';
import { Button, SizableText, Stack, XStack, YStack } from '../../primitives';
import {
  ARRANGE_MS,
  CARD,
  CARD_IN_START,
  MorphOverlay,
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
  ERROR_TEXT,
  FULL_STAGED_STEPS,
  SCENE_ANIMATION,
  STEP_POSE,
  STEP_TEXT,
  resolveCapsuleText,
  resolvePassphrasePanelText,
  resolveStageText,
} from './stepCopy';
import { StepText, TEXT_OUT_MS } from './StepText';

import type { IDeviceStageProps, IDeviceStageStep } from './type';
import type { IMorphAimFacts } from '../MorphOverlay';
import type { LayoutChangeEvent } from 'react-native';

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
 * name while connecting); every other step is card-class, its height
 * hugging that step's own content.
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
 * Still out of scope until ratified: presence in/out for real
 * integration, drag gestures, and accessibility focus.
 */

/** The capsule row, to the flow spec: the connecting-state device — the
 * same replica, worn thumbnail-small — beside a live title (and the
 * device's name while connecting). The row's paddings ARE the capsule's
 * measured size. */
const CAPSULE_ROW = {
  paddingX: 24,
  paddingY: 14,
  /** Thumbnail box the mini replica centers in. */
  thumbBox: 40,
  /** The mini replica's width — the spec's ~25pt device at stage aspect. */
  thumbDeviceWidth: 26,
  /** Gap between the thumbnail and the words. */
  gap: 12,
};

/** First-frame stand-in for the words block, corrected by its first
 * layout report — the card's height target is plain arithmetic over its
 * blocks (see the flow metrics in the component), so only the measured
 * blocks need estimates. */
const WORDS_ESTIMATED_HEIGHT = 64;

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
] as const;
type ICardArrangement = (typeof CARD_ARRANGEMENTS)[number];
const PANEL_WARM_MS = 475;

/** Confirm's payload card is the stage's last beat: it waits out the
 * arrangement move and the screen handover (the replica's own lit-to-lit
 * beat, see SCREEN_SWAP_MS), then its space lands in one piece — the
 * height spring carries the growth — under an opacity-only fade. */
const CONFIRM_CARD_DELAY_MS = ARRANGE_MS + SCREEN_SWAP_MS + 80;
const CONFIRM_CARD_IN_MS = 320;

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

/** Words tucked into the device foot (full stage) vs clear below (the
 * confirm miniature) — the stage's own spacing grammar. */
const WORDS_TUCK_MARGIN = -60;
const WORDS_CLEAR_MARGIN = 20;

const styles = StyleSheet.create({
  // The standing replica, anchored where every staged step seats it; the
  // active column leaves a spacer of its port's height, so the words and
  // panels lay out around a replica they never contain.
  replicaLayer: {
    position: 'absolute',
    top: CARD.padTop,
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

export function DeviceStage({
  step,
  deviceType,
  deviceName,
  confirmContext,
  confirmDetails,
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
}: IDeviceStageProps) {
  const pose = STEP_POSE[step];
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
  const spacerTarget = shownPort ?? 0;
  let wordsMarginTarget = 0;
  if (shownPort) {
    wordsMarginTarget =
      shownPort === PORT_HEIGHT ? WORDS_TUCK_MARGIN : WORDS_CLEAR_MARGIN;
  }
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

  // What the replica plays, on the stage's own lag: while the confirm
  // arrangement is moving the scene holds until the geometry has
  // landed; every other change hands over right away. The capsule side
  // always plays connecting — the thumbnail IS the connecting-state
  // device.
  const [sceneStep, setSceneStep] = useState(shownStep);
  const scenePortRef = useRef(shownPort);
  useEffect(() => {
    const geometryMoves = Boolean(
      scenePortRef.current && shownPort && scenePortRef.current !== shownPort,
    );
    scenePortRef.current = shownPort;
    if (sceneStep === shownStep) return undefined;
    if (reducedMotion || !geometryMoves) {
      setSceneStep(shownStep);
      return undefined;
    }
    const id = setTimeout(() => setSceneStep(shownStep), ARRANGE_MS);
    return () => clearTimeout(id);
  }, [reducedMotion, sceneStep, shownPort, shownStep]);
  let activeScene: IStageScene | undefined = 'connecting';
  if (pose === 'card') {
    activeScene = REPLICA_PORT[sceneStep]
      ? (SCENE_ANIMATION[sceneStep] as IStageScene | undefined)
      : undefined;
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
  // alone once the geometry and the screen handover are done.
  const hasConfirmDetails = Boolean(confirmDetails?.length);
  const [confirmCardShown, setConfirmCardShown] = useState(false);
  const confirmCardIn = useSharedValue(0);
  useEffect(() => {
    if (shownStep !== 'confirm' || !hasConfirmDetails) {
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
  }, [confirmCardIn, hasConfirmDetails, reducedMotion, shownStep]);

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
        opacity: interpolate(
          progress.value,
          [0, PILL_OUT_END],
          [1, 0],
          Extrapolation.CLAMP,
        ),
        transform: [{ translateY: -CARD.padTop }],
      };
    }
    return {
      opacity:
        replicaShown.value *
        swapFade.value *
        interpolate(
          progress.value,
          [CARD_IN_START, 1],
          [0, 1],
          Extrapolation.CLAMP,
        ),
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
  const stageText = resolveStageText(stageWordsStep, {
    confirmContext,
    hasChecklist: Boolean(authChecklist?.length),
  });
  const passphraseText = resolvePassphrasePanelText(passphraseMode);
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
  const capsuleTextRef = useRef(resolveCapsuleText('connecting', deviceName));
  if (pose === 'capsule') {
    // Straight off the live step: the column's words freeze on card
    // steps, but the capsule always speaks the present.
    capsuleTextRef.current = resolveCapsuleText(step, deviceName);
  }
  const capsuleText = capsuleTextRef.current;

  /* The parked columns, one per arrangement — each element memoized on
   * its own inputs, so a step change re-renders only the seats it
   * touched and every other parked column bails by identity. */
  const stagePanel = useMemo(
    () => (
      <YStack>
        <Animated.View style={spacerFlowStyle} />
        <Animated.View style={wordsStyle}>
          <Stack onLayout={panelMeasureHandlers.stage.words}>
            <StepText
              title={stageText.title}
              sub={stageText.sub}
              animated={stageAnimated}
            />
          </Stack>
        </Animated.View>
        <Stack onLayout={panelMeasureHandlers.stage.tail}>
          {/* The authenticity checklist rides the staged words the way
              confirm's payload card does — under them, on the same
              surface, its rows advanced by the driver; its presence
              flips on the words' beat (see stageChecklistShown). */}
          {stageChecklistShown && authChecklist?.length ? (
            <YStack mt="$6">
              <AuthChecklist items={authChecklist} />
            </YStack>
          ) : null}
          {confirmCardShown ? (
            <Animated.View style={confirmCardStyle}>
              <YStack
                mt="$6"
                borderRadius="$3"
                borderCurve="continuous"
                bg="rgba(255,255,255,0.06)"
                px="$3"
                py="$3"
                gap="$3"
              >
                {confirmDetails?.map((row) => (
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
        </Stack>
      </YStack>
    ),
    [
      authChecklist,
      confirmCardShown,
      confirmCardStyle,
      confirmDetails,
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
        <Stack onLayout={panelMeasureHandlers.pinOnApp.words}>
          <StepText title={STEP_TEXT.pinOnApp.title} sub="" animated={false} />
        </Stack>
        <Stack onLayout={panelMeasureHandlers.pinOnApp.tail}>
          <YStack mt="$4">
            <PinPad
              onSubmit={onPinSubmit}
              onSwitchToDevice={onSwitchToDevice}
              error={inputError}
              resetSignal={pinEpoch}
            />
          </YStack>
        </Stack>
      </YStack>
    ),
    [inputError, onPinSubmit, onSwitchToDevice, panelMeasureHandlers, pinEpoch],
  );
  const passphraseIntroPanel = useMemo(
    () => (
      <YStack>
        <Stack onLayout={panelMeasureHandlers.passphraseIntro.words}>
          <StepText
            title={STEP_TEXT.passphraseIntro.title}
            sub=""
            animated={false}
          />
        </Stack>
        <Stack onLayout={panelMeasureHandlers.passphraseIntro.tail}>
          <YStack mt="$4">
            <PassphraseIntro
              onContinue={onPassphraseIntroContinue}
              resetSignal={introEpoch}
            />
          </YStack>
        </Stack>
      </YStack>
    ),
    [introEpoch, onPassphraseIntroContinue, panelMeasureHandlers],
  );
  const passphrasePanel = useMemo(
    () => (
      <YStack>
        <Stack onLayout={panelMeasureHandlers.passphraseOnApp.words}>
          <StepText
            title={passphraseText.title}
            sub={passphraseText.sub ?? ''}
            animated={passphraseAnimated}
          />
        </Stack>
        <Stack onLayout={panelMeasureHandlers.passphraseOnApp.tail}>
          <YStack mt="$4">
            <PassphraseForm
              mode={passphraseMode}
              onSubmit={onPassphraseSubmit}
              onSwitchToDevice={onSwitchToDevice}
              onAttachPin={onPassphraseAttachPin}
              error={inputError}
              resetSignal={passphraseEpoch}
            />
          </YStack>
        </Stack>
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
    ],
  );
  const showQrPanel = useMemo(
    () => (
      <YStack>
        <Stack onLayout={panelMeasureHandlers.showQr.words}>
          <StepText title={STEP_TEXT.showQr.title} sub="" animated={false} />
        </Stack>
        <Stack onLayout={panelMeasureHandlers.showQr.tail}>
          <YStack mt="$4">
            <QrPresent value={qrValue} onNext={onQrNext} />
          </YStack>
        </Stack>
      </YStack>
    ),
    [onQrNext, panelMeasureHandlers, qrValue],
  );
  const scanQrPanel = useMemo(
    () => (
      <YStack>
        <Stack onLayout={panelMeasureHandlers.scanQr.words}>
          <StepText
            title={STEP_TEXT.scanQr.title}
            sub={STEP_TEXT.scanQr.sub ?? ''}
            animated={false}
          />
        </Stack>
        <Stack onLayout={panelMeasureHandlers.scanQr.tail}>
          <YStack mt="$4">
            <QrScanFrame onBack={onQrBack} />
          </YStack>
        </Stack>
      </YStack>
    ),
    [onQrBack, panelMeasureHandlers],
  );
  const authFailurePanel = useMemo(
    () => (
      <YStack>
        {/* The card fronts its icon above its own words, NOTE beat
            included, so the whole column is the words block; the tail
            stands empty. */}
        <Stack onLayout={panelMeasureHandlers.authFailure.words}>
          <AuthFailureCard
            reason={authFailureReason}
            checklist={authChecklist}
            onSupport={onAuthSupport}
            onRetry={onAuthRetry}
            onContinueAnyway={onAuthContinueAnyway}
            resetSignal={authFailureEpoch}
          />
        </Stack>
        <Stack onLayout={panelMeasureHandlers.authFailure.tail} />
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
        <Stack onLayout={panelMeasureHandlers.error.words}>
          <StepText
            title={errorCopy.title}
            sub={errorCopy.sub}
            animated={errorAnimated}
          />
        </Stack>
        <Stack onLayout={panelMeasureHandlers.error.tail}>
          {onErrorAction ? (
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
        </Stack>
      </YStack>
    ),
    [errorAnimated, errorCopy, onErrorAction, panelMeasureHandlers],
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
    }),
    [
      authFailurePanel,
      errorPanel,
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
      <Stack onLayout={handleDeviceLayout}>
        <HardwareDevice
          deviceType={deviceType}
          animation={activeScene}
          warmScenes={builtScenes}
          width={REPLICA_WIDTH}
          instantEntry={sceneEntryInstant}
          paused={hidden}
        />
      </Stack>
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
        pl={CAPSULE_ROW.paddingX}
        pr={CAPSULE_ROW.paddingX}
        py={CAPSULE_ROW.paddingY}
        gap={CAPSULE_ROW.gap}
        alignItems="center"
      >
        {/* The device's capsule seat, held open: the one standing replica
          wears the thumbnail arrangement over this box — the
          connecting-state device itself, never a second instance.
          Living outside the keyed row, it also never rebuilds when the
          capsule's words swap. */}
        <Stack width={CAPSULE_ROW.thumbBox} height={CAPSULE_ROW.thumbBox} />
        <YStack>
          {/* The sweep rests with the capsule: hidden poses neither pay
            its per-frame band nor resume it mid-glide. */}
          <ShimmerTitle paused={pose !== 'capsule'}>
            {capsuleText.title}
          </ShimmerTitle>
          {capsuleText.sub ? (
            <SizableText fontSize={13} lineHeight={20} color="$textSubdued">
              {capsuleText.sub}
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
    ),
    [capsuleText, pose],
  );

  return (
    <MorphOverlay
      morph={morph}
      cardInnerHeight={cardInnerHeight}
      cardContentMeasured={shownPanelMeasured}
      heightArrangeToken={shownPort}
      onAim={handleAim}
      capsuleKey={capsuleText.title}
      capsule={capsule}
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
