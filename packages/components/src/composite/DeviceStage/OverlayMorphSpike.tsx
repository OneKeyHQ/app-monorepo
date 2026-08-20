import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { TamaguiTheme as Theme } from '@onekeyhq/components/src/shared/tamagui';
import { getDisplayCornerRadius } from '@onekeyhq/shared/src/utils/displayCornerUtils';

import {
  CONTENT_IN_MS,
  SCREEN_SWAP_OUT_MS,
  easeInFn,
  easeOutFn,
} from '../../content/deviceScene';
import { HardwareDevice } from '../../content/HardwareDevice';
import { LinearGradient } from '../../content/LinearGradient';
import { Portal } from '../../hocs';
import { useSafeAreaInsets } from '../../hooks';
import { Button, SizableText, Stack, XStack, YStack } from '../../primitives';

import { PassphraseForm, PinPad } from './AppInputs';
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
  CONNECTING_TEXT,
  ERROR_TEXT,
  PASSPHRASE_CREATE_TEXT,
  SCENE_ANIMATION,
  STEP_TEXT,
} from './stepCopy';
import { StepText, TEXT_IN_MS, TEXT_OUT_MS } from './StepText';

import type {
  IDeviceStageErrorReason,
  IDeviceStageProps,
  IDeviceStageStep,
} from './type';
import type { IHardwareDeviceType } from '../../content/HardwareDevice';
import type { LayoutChangeEvent } from 'react-native';

/**
 * The overlay engine of the stage, generalized from the ratified two-pose
 * morph: one dark container plays the whole step vocabulary, resting as a
 * floating capsule when nothing is asked of the person and blooming into
 * the card when something is — the breathing the reference sold. Words,
 * scenes and panels come from the same modules the sheet engine reads, so
 * the two surfaces stay one product while they coexist.
 *
 * The pose table (the re-mappable heart of it): `off` is hidden — the
 * container is simply not there, and entrances appear at their pose;
 * `connecting` and `processing` are capsule-class — waiting beats worn
 * as the flow-spec pill (device thumbnail, sweeping live title, the
 * device's name while connecting); every other step is card-class, its
 * height hugging that step's own content. Crossings are springs re-aimed
 * mid-flight; card-to-card changes keep the pose and morph only the
 * height while the panels cross-fade.
 *
 * Geometry runs as one spring per axis on a single node; the replica is
 * ONE standing device across every pose — the capsule's thumbnail is the
 * same instance worn small, its scenes a troupe parked on one glass (see
 * useSceneTroupe) — and it teleports between its two seats inside the
 * cross-fade gap, where neither pose shows it. Its glass plays the
 * sheet's own handover between scenes — off, then a wake from black —
 * with arrivals from a hidden device granted instant entry. Card
 * content replays the sheet verbatim (the crossing grammar below):
 * inside the stage the words are StepText swapping in place and the
 * confirm move re-arranges on the sheet's clock; a change of
 * arrangement runs the two-phase swap on `swapFade`, landing content
 * and height target together on the empty beat; confirm's payload card
 * queues in last. The panels are the scenes' twin troupe (see
 * CARD_ARRANGEMENTS): parked built in their seats, so no crossing or
 * pose flip ever builds native views mid-animation. The container
 * rides the keyboard's own spring, so app-side inputs stay above it.
 *
 * Still out of scope until ratified: presence in/out, drag gestures, and
 * accessibility focus. Judge springs in a release build — dev-mode JS
 * load slanders the engine.
 */

export type IDeviceStageOverlayStep = Exclude<IDeviceStageStep, 'success'>;

/** The stage's opaque near-black face (see DeviceStage), restated here so
 * the overlay stays self-contained. */
const STAGE_BG = '#0A0A0C';

/* ----------------------------- tuning knobs ----------------------------- */

/** The resting capsule, to the flow spec: the connecting-state device —
 * the same replica, worn thumbnail-small — beside a live title (and the
 * device's name while connecting). It hugs its row: measured content,
 * paddings included; radius stays height/2, a true capsule. */
const PILL = {
  /** Clearance from the layer's bottom edge — the spec floats it clear. */
  lift: 32,
  paddingX: 24,
  paddingY: 14,
  /** Thumbnail box the mini replica centers in. */
  thumbBox: 40,
  /** The mini replica's width — the spec's ~25pt device at stage aspect. */
  thumbDeviceWidth: 26,
  /** Gap between the thumbnail and the words. */
  gap: 12,
  /** First-frame stand-ins, corrected by the row's first layout report. */
  estimatedWidth: 190,
  estimatedHeight: 68,
};

/** The expanded card, floating the way the system sheet itself floats
 * (the iOS 26 appearance: ~10-13pt of air on the sides and the bottom,
 * measured off the sheet on an iPhone 17 Pro): `margin` is that gap,
 * and the corner radius is concentric with the display (display corner
 * radius minus `margin`) wherever the device publishes one; `radius`
 * is the tuned fallback for everywhere else. Height hugs the content
 * column plus the bottom air (see `bottomGap`). `pad` restates the
 * sheet contract's 24pt side inset; `padTop` runs a little past it —
 * the sheet spends that band on its grabber, and the card keeps the
 * same visual air above the title. */
const CARD = {
  margin: 8,
  radius: 44,
  pad: 24,
  padTop: 32,
  /** The visual gap under the last block — the sheet contract's own
   * 16pt, restated; the card tops it up with the safe area, the way the
   * sheet's own face does (see cardBottomPad). */
  bottomGap: 16,
  /** The chin's floor: the sheet's face as drawn on a home-indicator
   * phone (bottomGap + the 34pt zone) — the ratified look. Surfaces
   * with no inset to add (the web canvas, older devices) wear the same
   * chin instead of the sheet's bare gap. */
  bottomFloor: 50,
};

/** First-frame stand-in for the words block, corrected by its first
 * layout report — the card's height target is plain arithmetic over its
 * blocks (see the flow metrics in the component), so only the measured
 * blocks need estimates. */
const WORDS_ESTIMATED_HEIGHT = 64;

/**
 * One spring for every geometry axis, so the morph reads as one gesture.
 * Tuned toward the system sheet's feel: settles ~600ms with a breath of
 * life, no visible wobble.
 */
const MORPH_SPRING = { mass: 1, stiffness: 230, damping: 26 };

/** Content fade windows on the capsule↔card progress. The capsule leaves
 * early (its drift while the box grows must stay imperceptible); the card
 * arrives across the back half, riding a slight scale-up. */
const PILL_OUT_END = 0.25;
const CARD_IN_START = 0.45;
const CARD_IN_SCALE_FROM = 0.92;

/** The capsule row's in-place word swap (connecting ↔ processing). */
const CAPSULE_SWAP_IN_MS = 200;
const CAPSULE_SWAP_IN_DELAY_MS = 80;
const CAPSULE_SWAP_OUT_MS = 120;

/* -------------------- the sheet's crossing grammar -------------------- *
 * Card-to-card changes replay DeviceStage verbatim. Steps group into
 * arrangements — one shared stage for the staged steps, every app-side
 * panel its own. A change inside an arrangement flows live: the words
 * swap in place, the confirm move re-arranges on the sheet's own clock.
 * A change of arrangement runs the two-phase swap: the outgoing side
 * fades out on the words' out beat, the content and the height target
 * land together on the empty beat — in one piece, so the box re-aims
 * exactly once, while nothing is on show — and the incoming side fades
 * in whole on the words' in beat. */
const ARRANGE_MS = 560;
const arrangeEase = Easing.bezierFn(0.4, 0, 0.2, 1);

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
  'error',
] as const;
type ICardArrangement = (typeof CARD_ARRANGEMENTS)[number];
const PANEL_WARM_MS = 475;

/** Confirm's payload card is the stage's last beat, the sheet's own
 * queue: it waits out the arrangement and the screen handover, then its
 * space lands in one piece (the height spring carries the growth) under
 * an opacity-only fade. */
const CONFIRM_CARD_DELAY_MS =
  ARRANGE_MS + SCREEN_SWAP_OUT_MS + CONTENT_IN_MS + 80;
const CONFIRM_CARD_IN_MS = 320;

/**
 * The scenes the one standing device can play, every one parked built on
 * its single glass (the troupe grant — see useSceneTroupe). Building a
 * scene's native tree (keypad, masks, gradients) is a main-thread freeze
 * that even a settle-lag could not hide — it read as a dead, dark beat
 * before the screen woke. So the freezes are paid once each, staggered
 * through the overlay's idle after mount, and a scene change is pure
 * opacity — the handover choreography, never a build. Parked scenes rest on their
 * opening stills (no invisible per-frame work) and a reveal runs the
 * choreography from 0, never mid-loop. `connecting` leads the list: it
 * is the capsule's thumbnail scene, on stage from the first beat, so it
 * ships built with the shell instead of waiting on a warm-up.
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
const THUMB_SCALE = PILL.thumbDeviceWidth / REPLICA_WIDTH;
/** Where along the capsule↔card progress the device teleports between
 * its two seats — inside the cross-fade gap (capsule content is gone by
 * PILL_OUT_END, card content arrives from CARD_IN_START), so the jump is
 * never on screen. */
const SEAT_SWAP_AT = 0.35;
/** First-frame stand-in for the replica's natural height, corrected by
 * its first layout report. */
const DEVICE_ESTIMATED_HEIGHT = 560;

/** The stage fog, the port mask's overlay twin. The sheet needs a real
 * mask — its face can be translucent system material — but the overlay's
 * face is always opaque STAGE_BG, so painting the same fade curve over
 * the device's foot composites pixel-identically, and the morph carries
 * no masked view. Geometry and stops restate ReplicaPort's. Hidden at
 * the thumbnail seat: the capsule wears the whole device, foot and all. */
const FOG_COLORS = ['rgba(10,10,12,0)', 'rgba(10,10,12,0.5)', '#0A0A0C'];
const FOG_LOCATIONS = [0, 0.58, 0.87] as const;

/**
 * Which arrangement a card step gives the standing replica: the full
 * stage for the device-side asks, the miniature for confirm, nothing for
 * the app-side inputs, the air-gap pair and the endings.
 */
const REPLICA_PORT: Partial<Record<IDeviceStageOverlayStep, number>> = {
  enterPin: PORT_HEIGHT,
  enterPassphrase: PORT_HEIGHT,
  confirm: COMPACT_PORT_HEIGHT,
};

/** The sheet's own grouping: the staged steps share one arrangement,
 * every other card step is its own — a crossing between two different
 * arrangements runs the two-phase swap. */
function arrangementOf(step: IDeviceStageOverlayStep): string {
  return REPLICA_PORT[step] ? 'stage' : step;
}

/** Words tucked into the device foot (full stage) vs clear below (the
 * confirm miniature) — the sheet stage's own spacing grammar. */
const WORDS_TUCK_MARGIN = -60;
const WORDS_CLEAR_MARGIN = 20;

/** Extra travel past the shell's own height when it sinks off the edge,
 * covering the lift and the home-indicator band. */
const EXIT_OVERSHOOT = 80;

/** Which rest pose a step belongs to: absent before the burst has
 * anything to say, the capsule for waiting beats — nothing is asked of
 * the person — and the card for everything else. */
function poseOf(step: IDeviceStageOverlayStep): 'hidden' | 'capsule' | 'card' {
  if (step === 'off') {
    return 'hidden';
  }
  return step === 'connecting' || step === 'processing' ? 'capsule' : 'card';
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  // Shadow lives on the outer shell; the inner face clips. iOS clips a
  // layer's shadow together with its content when overflow is hidden, so
  // one view cannot both cast and clip.
  shell: {
    backgroundColor: STAGE_BG,
    // Apple's corner language, the repo-wide convention for rounded
    // surfaces; the capsule at radius = height/2 reads Dynamic-Island
    // continuous, not circular.
    borderCurve: 'continuous',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: STAGE_BG,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
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
  // Full-port geometry like the mask it restates: the fade stays put
  // while the window above animates.
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
  // Hugs from the top: the row's own paddings are the capsule's height,
  // so the container and its content agree by construction.
  pillContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  // Anchored to the container's horizontal center at its final width, so
  // the growing face reveals it center-out, symmetric like the reference.
  cardContent: {
    position: 'absolute',
    top: 0,
    left: '50%',
  },
  // Every seat spans the card's width at its top; height hugs its own
  // column. Hidden seats stay laid out — their measures keep the height
  // targets honest — they just show and touch nothing.
  panelSeat: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  panelSeatHidden: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    opacity: 0,
  },
  // Above the port the words tuck into.
  wordsBlock: {
    zIndex: 1,
  },
});

/**
 * One parked panel's seat in the card. Visibility is a plain style
 * flip: the land commit swaps which seat is lit while nothing is on
 * show, and every live fade belongs to the wrapper above (swapFade and
 * the pose window) — never to the seat, so nothing can relight over a
 * reveal.
 */
function PanelSeat({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <View
      style={active ? styles.panelSeat : styles.panelSeatHidden}
      pointerEvents={active ? 'box-none' : 'none'}
    >
      {children}
    </View>
  );
}

export function DeviceStageOverlaySpike({
  step,
  deviceType,
  deviceName,
  confirmContext,
  confirmDetails,
  qrValue,
  onQrNext,
  onQrBack,
  errorReason,
  onErrorAction,
  onPinSubmit,
  onPassphraseIntroContinue,
  passphraseMode,
  onPassphraseSubmit,
  onPassphraseAttachPin,
  onSwitchToDevice,
  inputError,
}: {
  step: IDeviceStageOverlayStep;
  deviceType: IHardwareDeviceType;
  /** The connected device's name — the connecting capsule's second line. */
  deviceName?: string;
  confirmContext?: string;
  confirmDetails?: IDeviceStageProps['confirmDetails'];
  qrValue?: string;
  onQrNext?: () => void;
  onQrBack?: () => void;
  errorReason?: IDeviceStageErrorReason;
  onErrorAction?: () => void;
  onPinSubmit?: (pin: string) => void;
  onPassphraseIntroContinue?: IDeviceStageProps['onPassphraseIntroContinue'];
  passphraseMode?: 'create' | 'verify';
  onPassphraseSubmit?: IDeviceStageProps['onPassphraseSubmit'];
  onPassphraseAttachPin?: IDeviceStageProps['onPassphraseAttachPin'];
  onSwitchToDevice?: IDeviceStageProps['onSwitchToDevice'];
  inputError?: string;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const keyboard = useAnimatedKeyboard();
  const cardWidth = screenWidth - CARD.margin * 2;
  // The sheet's own chin, carried over whole onto the card's face:
  // bottomGap plus the safe area under the last element, floored so
  // inset-less surfaces wear the same look. The chin is read against
  // the face, not the screen edge — that is how the eye reads it.
  // While the card rides the keyboard the zone is gone but the chin
  // stays: a transient over-pad, accepted over re-laying the box out
  // on every keyboard frame.
  const cardBottomPad = Math.max(CARD.bottomFloor, CARD.bottomGap + safeBottom);
  // A launch-time device constant; memoized only to skip the Settings
  // read on re-renders.
  const cardRadius = useMemo(() => {
    const screenCornerRadius = getDisplayCornerRadius();
    return screenCornerRadius ? screenCornerRadius - CARD.margin : CARD.radius;
  }, []);

  const pose = poseOf(step);

  // The sheet's crossing machine, verbatim: a change of arrangement
  // holds the shown step while the outgoing side fades on the words'
  // out beat, lands it on the empty beat — content and height target
  // together, in one piece — then reveals on the words' in beat.
  // Everything content-side below reads `shownStep`. Pose flips bypass
  // the machine: the capsule windows carry those changes.
  const [heldStep, setHeldStep] = useState(step);
  const crossing =
    pose === 'card' &&
    poseOf(heldStep) === 'card' &&
    arrangementOf(heldStep) !== arrangementOf(step);
  const shownStep = crossing ? heldStep : step;
  const stepTargetRef = useRef(step);
  stepTargetRef.current = step;
  const swapFade = useSharedValue(1);
  // Only lands the step; the reveal happens in the effect below, AFTER
  // the landed content has committed (a shared-value write issued next
  // to the setState reaches the UI thread a frame early).
  const landPanel = useCallback(() => {
    setHeldStep(stepTargetRef.current);
  }, []);
  useEffect(() => {
    if (pose !== 'card') {
      // The card is not on show: land silently, the pose windows carry
      // whatever changed.
      cancelAnimation(swapFade);
      swapFade.value = 1;
      if (heldStep !== step) {
        setHeldStep(step);
      }
      return;
    }
    if (heldStep === step) {
      // The reveal after a landing — and the re-aim that heals an
      // interrupted out-phase, so the card can never stay half-lit.
      cancelAnimation(swapFade);
      if (reducedMotion) {
        swapFade.value = 1;
        return;
      }
      swapFade.value = withTiming(1, {
        duration: TEXT_IN_MS,
        easing: easeOutFn,
      });
      return;
    }
    if (arrangementOf(heldStep) === arrangementOf(step)) {
      // Same arrangement: `shownStep` already follows the live step —
      // this only keeps the bookkeeping current.
      setHeldStep(step);
      return;
    }
    if (reducedMotion) {
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
  }, [heldStep, landPanel, pose, reducedMotion, step, swapFade]);

  const shownPort = REPLICA_PORT[shownStep];

  // Which seat the card lights: the last card-class arrangement, frozen
  // through capsule poses so a flip never swaps the fading content
  // mid-exit — the pose window owns that fade, and the parked seats
  // simply hold. Render-time ref write on purpose: the read is in the
  // same pass and the write is idempotent.
  const activeArrangementRef = useRef<ICardArrangement>(
    poseOf(step) === 'card'
      ? (arrangementOf(step) as ICardArrangement)
      : 'stage',
  );
  if (pose === 'card') {
    activeArrangementRef.current = arrangementOf(shownStep) as ICardArrangement;
  }
  const activeArrangement = activeArrangementRef.current;

  // The troupe's roll-call, the scene warm-up's twin: parked seats never
  // leave, and the active arrangement renders at once even before its
  // warm-up beat — the one cold build left, for a first visit that
  // outruns the ladder.
  const [builtPanels, setBuiltPanels] = useState<ICardArrangement[]>([]);
  const shownPanels = useMemo(
    () =>
      CARD_ARRANGEMENTS.filter(
        (name) => name === activeArrangement || builtPanels.includes(name),
      ),
    [activeArrangement, builtPanels],
  );
  useEffect(() => {
    if (!builtPanels.includes(activeArrangement)) {
      setBuiltPanels((current) =>
        current.includes(activeArrangement)
          ? current
          : [...current, activeArrangement],
      );
      return undefined;
    }
    const next = CARD_ARRANGEMENTS.find((name) => !builtPanels.includes(name));
    if (!next) {
      return undefined;
    }
    const id = setTimeout(
      () =>
        setBuiltPanels((current) =>
          current.includes(next) ? current : [...current, next],
        ),
      PANEL_WARM_MS,
    );
    return () => clearTimeout(id);
  }, [activeArrangement, builtPanels]);

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

  // Both rest poses hug their content: the capsule row (paddings of its
  // own, so its box IS the capsule) and the active card column each
  // report their natural size and the springs re-aim to the measured
  // rests. The estimates only cover the first frames of a fresh pose.
  const [pillSize, setPillSize] = useState<{ width: number; height: number }>({
    width: PILL.estimatedWidth,
    height: PILL.estimatedHeight,
  });
  const handlePillRowLayout = useCallback((event: LayoutChangeEvent) => {
    const { width: rowWidth, height: rowHeight } = event.nativeEvent.layout;
    setPillSize({
      width: Math.ceil(rowWidth),
      height: Math.ceil(rowHeight),
    });
  }, []);
  // Every seat reports its own words and tail blocks — from wrappers
  // whose frames sit still inside the animated flow, so these fire on
  // size changes only, never per animation frame. The map is what lets
  // a crossing truly land content and height target together: the
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
  // The staged arrangement's flow metrics: the sheet animates its port
  // window and words margin in layout, and the column here does the
  // same on the arrangement clock — so the card's height target is
  // plain arithmetic over the blocks, and it moves only when the shown
  // step does: on the empty beat of a crossing, or live inside the
  // stage.
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
  const cardHeight =
    CARD.padTop +
    spacerTarget +
    wordsMarginTarget +
    (shownPanel?.words ?? WORDS_ESTIMATED_HEIGHT) +
    (shownPanel?.tail ?? 0) +
    cardBottomPad;

  // What the replica plays, on the sheet's own lag: while the confirm
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
  // The instant-entry grant, the sheet's own rule and bookkeeping: an
  // arrival whose reveal the presenter carries (the device coming back
  // from a step that hid it, or the shell's entrance) lands already
  // lit — a wake ramp under that fade would play as dead black. The
  // grant covers exactly the arrival's own entry: any later step
  // movement retires it, so handovers on glass that stayed in view
  // keep the ramp. Render-time ref writes on purpose, the sheet's own
  // pattern: the reads are in the same pass and the writes idempotent.
  const deviceOnShow = pose === 'capsule' || Boolean(shownPort);
  const deviceWasOnShowRef = useRef(deviceOnShow);
  const entryInstantRef = useRef(false);
  const arrivalStepRef = useRef<IDeviceStageOverlayStep | undefined>(undefined);
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
  // The troupe warm-up: one scene built per idle beat, the current step's
  // own scene jumping the queue. Once a scene is in the list it never
  // leaves — the whole point is that no crossing ever builds anything
  // again. The connecting scene is born built: the capsule needs it from
  // the first frame, exactly as the old separate thumbnail paid for it
  // at mount.
  const [builtScenes, setBuiltScenes] = useState<IStageScene[]>(['connecting']);
  useEffect(() => {
    if (builtScenes.length >= STAGE_SCENES.length) {
      return undefined;
    }
    const priority =
      activeScene && !builtScenes.includes(activeScene)
        ? activeScene
        : undefined;
    const next = priority ?? STAGE_SCENES.find((s) => !builtScenes.includes(s));
    if (!next) {
      return undefined;
    }
    // A step already waiting on its scene builds it past the springs'
    // settle; idle warm-up keeps a lazier beat.
    const id = setTimeout(
      () =>
        setBuiltScenes((current) =>
          current.includes(next) ? current : [...current, next],
        ),
      priority ? 600 : SCENE_WARM_MS,
    );
    return () => clearTimeout(id);
  }, [activeScene, builtScenes]);

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

  // One spring per geometry axis, re-aimed together on every pose or
  // measurement change — not a single progress interpolation, which would
  // snap card-to-card height changes instead of springing them (with the
  // pose held, a progress spring has nowhere left to travel). `progress`
  // survives only as the content fade window between the two poses;
  // `presence` is the whole shell's being-there, the hidden pose's axis.
  const hidden = pose === 'hidden';
  const width = useSharedValue(
    pose === 'card' ? cardWidth : PILL.estimatedWidth,
  );
  const height = useSharedValue(
    pose === 'card' ? cardHeight : PILL.estimatedHeight,
  );
  const radius = useSharedValue(
    pose === 'card' ? cardRadius : PILL.estimatedHeight / 2,
  );
  const lift = useSharedValue(pose === 'card' ? CARD.margin : PILL.lift);
  const progress = useSharedValue(pose === 'card' ? 1 : 0);
  const presence = useSharedValue(hidden ? 0 : 1);
  const replicaShown = useSharedValue(shownPort ? 1 : 0);
  const portHeight = useSharedValue(shownPort ?? PORT_HEIGHT);
  const deviceScale = useSharedValue(
    shownStep === 'confirm' ? COMPACT_SCALE : 1,
  );
  const spacerHeight = useSharedValue(spacerTarget);
  const wordsMargin = useSharedValue(wordsMarginTarget);
  const shownArrangement = arrangementOf(shownStep);
  const prevPoseRef = useRef(pose);
  const prevArrangementRef = useRef(shownArrangement);
  const prevShownPortRef = useRef(shownPort);
  // Layout effect on purpose: the springs are aimed before this commit
  // paints, so the first morph frame ships with the driver's own
  // re-render instead of one frame behind it.
  useLayoutEffect(() => {
    const prevPose = prevPoseRef.current;
    prevPoseRef.current = pose;
    const prevArrangement = prevArrangementRef.current;
    prevArrangementRef.current = shownArrangement;
    const prevShownPort = prevShownPortRef.current;
    prevShownPortRef.current = shownPort;
    if (pose === 'hidden') {
      // The shell leaves the way the system sheet does: it sinks whole
      // below the bottom edge, opaque all the way. Geometry holds, so
      // the slide never doubles as a shrink.
      presence.value = reducedMotion ? 0 : withSpring(0, MORPH_SPRING);
      return;
    }
    const card = pose === 'card';
    const targets = {
      width: card ? cardWidth : pillSize.width,
      height: card ? cardHeight : pillSize.height,
      // A capsule's radius tracks its own height — always half of it.
      radius: card ? cardRadius : pillSize.height / 2,
      lift: card ? CARD.margin : PILL.lift,
      progress: card ? 1 : 0,
      replicaShown: shownPort ? 1 : 0,
    };
    // An entrance appears already at its pose — geometry snaps while the
    // shell is still invisible, then presence carries the arrival.
    const arriving = prevPose === 'hidden';
    if (reducedMotion || arriving) {
      width.value = targets.width;
      height.value = targets.height;
      radius.value = targets.radius;
      lift.value = targets.lift;
      progress.value = targets.progress;
      replicaShown.value = targets.replicaShown;
      spacerHeight.value = spacerTarget;
      wordsMargin.value = wordsMarginTarget;
      if (shownPort) {
        portHeight.value = shownPort;
        deviceScale.value = shownStep === 'confirm' ? COMPACT_SCALE : 1;
      }
      presence.value = reducedMotion ? 1 : withSpring(1, MORPH_SPRING);
      return;
    }
    // The stage's own arrangement move (the confirm shrink and back)
    // runs on the sheet's clock; everything else rides the box springs.
    // Content-side targets only ever change with `shownStep` — a
    // crossing re-aims them exactly once, on the empty beat.
    const stageMove =
      card &&
      prevPose === 'card' &&
      Boolean(prevShownPort) &&
      Boolean(shownPort) &&
      prevShownPort !== shownPort;
    presence.value = withSpring(1, MORPH_SPRING);
    width.value = withSpring(targets.width, MORPH_SPRING);
    // A crossing lands content and height target together — in one
    // piece — because the incoming seat was measured while parked. Only
    // a cold-built seat has no numbers yet on its land commit; aiming
    // there would dip the box toward a phantom target, so that one
    // defers to the seat's first report, a frame later, still inside
    // the empty beat.
    const landed =
      card && prevPose === 'card' && prevArrangement !== shownArrangement;
    if (!landed || shownPanelMeasured) {
      height.value = stageMove
        ? withTiming(targets.height, {
            duration: ARRANGE_MS,
            easing: arrangeEase,
          })
        : withSpring(targets.height, MORPH_SPRING);
    }
    radius.value = withSpring(targets.radius, MORPH_SPRING);
    lift.value = withSpring(targets.lift, MORPH_SPRING);
    progress.value = withSpring(targets.progress, MORPH_SPRING);
    // The gate lands in one piece — the branch fades (swapFade and the
    // pose windows) carry the replica's actual visibility, the sheet's
    // own division of labor.
    replicaShown.value = targets.replicaShown;
    // A hidden replica holds its last arrangement instead of animating
    // offstage, so it re-enters exactly as it left — which also means
    // the arrangement it left in may not be the one it returns to. Like
    // the flow twins below, the pair lands the new arrangement in one
    // piece on a crossing or a pose arrival (otherwise a stale confirm
    // miniature grows to full size under the reveal); only a live stage
    // move — the confirm shrink and back, on show — runs on the clock.
    if (shownPort) {
      const scaleTarget = shownStep === 'confirm' ? COMPACT_SCALE : 1;
      if (prevPose !== 'card' || prevArrangement !== shownArrangement) {
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
    if (card) {
      if (prevPose !== 'card' || prevArrangement !== shownArrangement) {
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
  }, [
    cardHeight,
    cardRadius,
    cardWidth,
    deviceScale,
    height,
    lift,
    pillSize,
    pose,
    presence,
    progress,
    portHeight,
    radius,
    reducedMotion,
    replicaShown,
    shownArrangement,
    shownPanelMeasured,
    shownPort,
    shownStep,
    spacerHeight,
    spacerTarget,
    width,
    wordsMargin,
    wordsMarginTarget,
  ]);

  const geometryStyle = useAnimatedStyle(
    () => ({
      width: width.value,
      height: height.value,
      borderRadius: radius.value,
      // The container rides the keyboard's own animation curve, so the
      // app-side inputs stay above it frame for frame.
      marginBottom: lift.value + keyboard.height.value,
      // Being-there, the sheet's own door: exits sink the whole shell
      // below the bottom edge, entrances rise from there — opaque all
      // the way, like a presented sheet.
      transform: [
        {
          translateY:
            (1 - presence.value) * (height.value + lift.value + EXIT_OVERSHOOT),
        },
      ],
    }),
    [height, keyboard, lift, presence, radius, width],
  );
  // The face clips, so it re-rounds in step with the shell.
  const faceRadiusStyle = useAnimatedStyle(
    () => ({ borderRadius: radius.value }),
    [radius],
  );
  const pillFadeStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(
        progress.value,
        [0, PILL_OUT_END],
        [1, 0],
        Extrapolation.CLAMP,
      ),
    }),
    [progress],
  );
  // The pose window times the crossing swap: swapFade is the sheet's
  // two-phase branch fade, 1 whenever no crossing is in flight.
  const cardFadeStyle = useAnimatedStyle(
    () => ({
      width: cardWidth,
      marginLeft: -cardWidth / 2,
      opacity:
        swapFade.value *
        interpolate(
          progress.value,
          [CARD_IN_START, 1],
          [0, 1],
          Extrapolation.CLAMP,
        ),
      transform: [
        {
          scale: interpolate(
            progress.value,
            [CARD_IN_START, 1],
            [CARD_IN_SCALE_FROM, 1],
            Extrapolation.CLAMP,
          ),
        },
      ],
    }),
    [cardWidth, progress, swapFade],
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
          { translateX: PILL.paddingX + PILL.thumbBox / 2 - width.value / 2 },
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
  }, [deviceHeight, deviceScale, pillHeight, progress, width]);
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

  const shellStyle = useMemo(
    () => [styles.shell, geometryStyle],
    [geometryStyle],
  );
  const faceStyle = useMemo(
    () => [styles.face, faceRadiusStyle],
    [faceRadiusStyle],
  );
  const pillStyle = useMemo(
    () => [styles.pillContent, pillFadeStyle],
    [pillFadeStyle],
  );
  const cardStyle = useMemo(
    () => [styles.cardContent, cardFadeStyle],
    [cardFadeStyle],
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
  const stageWordsRef = useRef<IDeviceStageOverlayStep>(
    REPLICA_PORT[step] ? step : 'enterPin',
  );
  if (REPLICA_PORT[step]) {
    stageWordsRef.current = step;
  }
  const stageWordsStep = stageWordsRef.current;
  const stageText = STEP_TEXT[stageWordsStep];
  const stageSub =
    (stageWordsStep === 'confirm' ? confirmContext : stageText.sub) ?? '';
  const passphraseText =
    passphraseMode === 'create'
      ? PASSPHRASE_CREATE_TEXT
      : STEP_TEXT.passphraseOnApp;
  const stageAnimated = activeArrangement === 'stage' && !reducedMotion;
  const passphraseAnimated =
    activeArrangement === 'passphraseOnApp' && !reducedMotion;
  const errorAnimated = activeArrangement === 'error' && !reducedMotion;
  // The capsule keeps its own last words while another pose plays, so
  // the (invisible) row never re-measures against a card title and the
  // size springs always aim at true capsule content. Connecting wears
  // the device's name as its second line, per the flow spec. Render-time
  // ref write on purpose: the read is in the same pass and the write is
  // idempotent.
  const capsuleTextRef = useRef<{ title: string; sub?: string }>({
    title: CONNECTING_TEXT.title,
    sub: deviceName,
  });
  if (pose === 'capsule') {
    capsuleTextRef.current = {
      // Straight off the live step: the column's words freeze on card
      // steps, but the capsule always speaks the present.
      title: STEP_TEXT[step].title,
      sub: step === 'connecting' ? deviceName : undefined,
    };
  }
  const capsuleText = capsuleTextRef.current;

  /* The parked columns, one per arrangement — each element memoized on
   * its own inputs, so a step change re-renders only the seats it
   * touched and every other parked column bails by identity. */
  const stagePanel = useMemo(
    () => (
      <YStack pt={CARD.padTop} px={CARD.pad}>
        <Animated.View style={spacerFlowStyle} />
        <Animated.View style={wordsStyle}>
          <Stack onLayout={panelMeasureHandlers.stage.words}>
            <StepText
              title={stageText.title}
              sub={stageSub}
              animated={stageAnimated}
            />
          </Stack>
        </Animated.View>
        <Stack onLayout={panelMeasureHandlers.stage.tail}>
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
      confirmCardShown,
      confirmCardStyle,
      confirmDetails,
      panelMeasureHandlers,
      spacerFlowStyle,
      stageAnimated,
      stageSub,
      stageText,
      wordsStyle,
    ],
  );
  const pinPanel = useMemo(
    () => (
      <YStack pt={CARD.padTop} px={CARD.pad}>
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
      <YStack pt={CARD.padTop} px={CARD.pad}>
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
      <YStack pt={CARD.padTop} px={CARD.pad}>
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
      <YStack pt={CARD.padTop} px={CARD.pad}>
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
      <YStack pt={CARD.padTop} px={CARD.pad}>
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
  const errorPanel = useMemo(
    () => (
      <YStack pt={CARD.padTop} px={CARD.pad}>
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
                testID="device-stage-overlay-error-action"
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
  const panelByArrangement: Record<ICardArrangement, ReactNode> = {
    stage: stagePanel,
    pinOnApp: pinPanel,
    passphraseIntro: passphraseIntroPanel,
    passphraseOnApp: passphrasePanel,
    showQr: showQrPanel,
    scanQr: scanQrPanel,
    error: errorPanel,
  };

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

  return (
    // The main window's hardware-dialog level: the app mounts this portal
    // beside its dialog containers, the storybook shells mount it
    // canvas-wide. Deliberately NOT a FullWindowOverlay window — that sat
    // above every presentation, so the in-app browser (an ordinary
    // presentation) opened underneath the stage; at dialog level,
    // presentations cover it the way they cover the system sheet.
    <Portal.Body container={Portal.Constant.HARDWARE_UI_STATE_DIALOG}>
      <Stack style={styles.layer} pointerEvents="box-none">
        <Animated.View style={shellStyle}>
          <Animated.View style={faceStyle}>
            <Theme name="dark">
              {/* The standing set: ONE device across every pose, never
                  rebuilt, only re-seated — thumbnail-small beside the
                  capsule's words, the full stage or the confirm
                  miniature on the card. Its scenes live parked on its
                  one glass (the troupe grant): a crossing flips which
                  is lit and nothing ever builds; only the visible
                  scene's clock runs, from 0. The fog overlay restates
                  the sheet's port mask over the opaque face, and rests
                  while the capsule wears the whole device. */}
              <Animated.View style={replicaStyle} pointerEvents="none">
                <Animated.View style={portStyle}>
                  <Animated.View style={deviceStyle}>
                    {deviceLayer}
                  </Animated.View>
                  <Animated.View style={fogStyle}>
                    <LinearGradient
                      colors={FOG_COLORS}
                      locations={FOG_LOCATIONS}
                      style={styles.fogFill}
                    />
                  </Animated.View>
                </Animated.View>
              </Animated.View>
              {/* Always mounted: this wrapper carries the pose window
                  and the crossing swapFade — the sheet's branch fade —
                  over the parked seats inside. The stage seat persists
                  across its steps (StepText swaps in place, the confirm
                  move re-arranges on the sheet's clock); a crossing
                  only flips which seat is lit, on the empty beat, and
                  builds nothing. No mount fades anywhere here — the
                  wrapper owns every fade, and seats never leave. */}
              <Animated.View style={cardStyle}>
                {shownPanels.map((name) => (
                  <PanelSeat key={name} active={name === activeArrangement}>
                    {panelByArrangement[name]}
                  </PanelSeat>
                ))}
              </Animated.View>
              <Animated.View style={pillStyle} pointerEvents="none">
                {/* Keyed by its words: connecting and processing swap the
                    row in place with a fade — the capsule itself never
                    moves. */}
                <Animated.View
                  key={capsuleText.title}
                  entering={FadeIn.duration(CAPSULE_SWAP_IN_MS).delay(
                    CAPSULE_SWAP_IN_DELAY_MS,
                  )}
                  exiting={FadeOut.duration(CAPSULE_SWAP_OUT_MS)}
                >
                  <XStack
                    pl={PILL.paddingX}
                    pr={PILL.paddingX}
                    py={PILL.paddingY}
                    gap={PILL.gap}
                    alignItems="center"
                    onLayout={handlePillRowLayout}
                  >
                    {/* The device's capsule seat, held open: the one
                        standing replica wears the thumbnail arrangement
                        over this box — the connecting-state device
                        itself, never a second instance. Living outside
                        the keyed row, it also no longer rebuilds when
                        the capsule's words swap. */}
                    <Stack width={PILL.thumbBox} height={PILL.thumbBox} />
                    <YStack>
                      {/* The sweep rests with the capsule: hidden poses
                          neither pay its per-frame band nor resume it
                          mid-glide. */}
                      <ShimmerTitle paused={pose !== 'capsule'}>
                        {capsuleText.title}
                      </ShimmerTitle>
                      {capsuleText.sub ? (
                        <SizableText
                          fontSize={13}
                          lineHeight={20}
                          color="$textSubdued"
                        >
                          {capsuleText.sub}
                        </SizableText>
                      ) : null}
                    </YStack>
                  </XStack>
                </Animated.View>
              </Animated.View>
            </Theme>
          </Animated.View>
        </Animated.View>
      </Stack>
    </Portal.Body>
  );
}
