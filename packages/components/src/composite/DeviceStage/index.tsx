import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { Keyboard, PixelRatio, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ThirdPartyWalletAvatarImages,
  getThirdPartyDeviceAvatarImage,
} from '@onekeyhq/shared/src/utils/avatarUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { easeOutFn } from '../../content/deviceScene';
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
import {
  CARD_ARRANGEMENTS,
  arrangementOf,
  panelLeftBehind,
} from './arrangements';
import { AuthChecklist, AuthFailureCard } from './AuthPanels';
import { BluetoothBadge } from './BluetoothBadge';
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
  resolveErrorMessage,
  resolveInstallText,
  resolvePairingCodeText,
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
import { WalletTypeOptions } from './WalletTypeOptions';

import type { ICardArrangement } from './arrangements';
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
 * rides the words' beat. The panels are the scenes' twin troupe (see
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
const PANEL_WARM_MS = 475;

/** The actionless error is a notice — it informs, holds long enough to
 * read, then leaves on its own. The exit is a request through the same
 * close grant the ✕ fires, so the driver keeps the last word (and
 * answers with `off`, as ever). Measured from the words landing on
 * show, not from the step change. */
const ERROR_NOTICE_EXIT_MS = 3000;

/** The replica's exit and return around the notice's capsule seat — its
 * own quick fade, since the label swap carries no window for the
 * overlay-level layers. */
const CAPSULE_SEAT_FADE_MS = 200;

/** The confirm card's own inks. The stage is committed dark (STAGE_BG),
 * so the risk colors are its own, not theme tokens — a light theme would
 * otherwise pull the panels out from under the hardcoded white type. */
const CONFIRM_DANGER_BG = 'rgba(255,80,70,0.13)';
const CONFIRM_DANGER_INK = '#FF8D84';

/** The PIN-entry switch line (OK-61489): a text line's 20pt row plus
 * this slop reaches the 44pt touch floor. */
const PIN_SWITCH_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
const PIN_SWITCH_PRESS = { opacity: 0.5 };
const PIN_SWITCH_HOVER = { color: '$textInteractiveHover' } as const;

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

/** The display's physical pixels per point — worklet-captured for
 * pixel-grid snapping of transform offsets. */
const PIXEL_GRID = PixelRatio.get();

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
  // Anchored to the LEFT edge and centered by the worklet's translateX
  // below: a percentage left re-resolves in LAYOUT on every frame of
  // the box's width spring, dirtying this auto-height stack each frame.
  // A transform costs the compositor nothing — the same lane the
  // shell's own positionStyle rides. (One cut off the per-frame commit
  // bill, not the whole bill — the 2026-08-28 audit's ledger.)
  replicaLayer: {
    position: 'absolute',
    top: REPLICA_TOP,
    left: 0,
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
 * The stage tail's contents enter on the words' own beat. On a live
 * in-stage change the words land at the end of StepText's out phase,
 * while a tail mounting on the step change would report its height on
 * the very next frame — two re-aims, and the box visibly heads for the
 * interim target before doubling back. Deferring the mount to the
 * words' clock lands both measures together, so the height re-aims
 * once, straight at the final height. Leaving is immediate even live:
 * the tail belongs to the outgoing step, and holding it through the
 * out beat while the port already glides toward the incoming step aims
 * the box at a composite height no beat ever shows — a blank band
 * under the words until the deferred unmount caught up (2026-08-31).
 * Every other path — a pose arrival, a parked seat, reduced motion —
 * snaps too, in a layout effect so stale parked content never reaches
 * the screen: an entrance would otherwise paint last visit's tail for
 * a beat before dropping it.
 */
function useStageTailFlag(want: boolean, liveOnShow: boolean): boolean {
  const [shown, setShown] = useState(want);
  useLayoutEffect(() => {
    if (shown === want) {
      return undefined;
    }
    if (!liveOnShow || !want) {
      setShown(want);
      return undefined;
    }
    const id = setTimeout(() => setShown(want), TEXT_OUT_MS);
    return () => clearTimeout(id);
  }, [liveOnShow, shown, want]);
  return shown;
}

/**
 * The stage's haptic grammar (expo-haptics maps the same calls onto
 * Android): notification-class for the outcome news, one heavy impact
 * for a card arriving under the hand — fired the moment the container
 * starts moving toward it (the step change), because under the hand
 * the transition itself is the event; a settle-fired buzz read as a
 * detached afterthought (2026-08-31, on device). Everything else stays
 * silent — the capsule appearing, returning to it, and the dismissals
 * are attention released, not demanded — matching the system sheets'
 * own restraint. The primitive itself gates every fire on the app's
 * haptics setting, and is a no-op off the phones.
 */
function fireStepHaptic(step: IDeviceStageStep) {
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
  Haptics.impact(ImpactFeedbackStyle.Heavy);
}

export function DeviceStage({
  step,
  deviceType,
  deviceName,
  connectionType,
  onClose,
  confirmDetails,
  confirmMessage,
  confirmDescription,
  confirmDescriptionDanger,
  confirmCount,
  qrValue,
  qrValueUr,
  qrScannerView,
  onQrNext,
  onQrBack,
  errorReason,
  errorMessage,
  errorI18n,
  authChecklist,
  authFailureReason,
  onAuthSupport,
  onAuthRetry,
  allowAuthDevSkip,
  onAuthContinueAnyway,
  onErrorAction,
  onPinSubmit,
  onSwitchPinInputToApp,
  onSelectWalletType,
  onPassphraseIntroContinue,
  passphraseIntroKeepShortcut,
  passphraseMode,
  passphraseKeepAccessible,
  passphraseAllowUtf8,
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
  onDeviceNotFoundTroubleshoot,
  onDeviceNotFoundSupport,
  onBtcHighIndexConfirm,
  onInstallConfirm,
}: IDeviceStageProps) {
  // The actionless error is the notice — `done`'s ✗ sibling: nothing is
  // asked, so it rests as the capsule (the failure glyph beside the
  // reason's title, no second line) and leaves on its own (see the exit
  // effect below). With an action the step keeps its ask card.
  const errorNotice = step === 'error' && !onErrorAction;
  const pose = errorNotice ? 'capsule' : STEP_POSE[step];
  // While the box is in flight the screen holds still: the triage
  // (2026-08-21) caught the UI thread freezing once per capsule<->card
  // morph, in the flight's own window, scaling with the scene's paint
  // (the Pro 2's worst) — the incoming scene's first lighting is one
  // large main-thread composite, and paying it mid-flight is the stutter.
  // (A shouldRasterizeIOS freeze was tried first and made it worse: the
  // raster's own on/off each cost a full offscreen pass.) So the pose
  // flight defers the screen handover the way the confirm shrink always
  // has — the scene holds until the geometry has landed (see sceneStep
  // below). Render-phase state write on purpose: the hold must ship in
  // the same commit that starts the springs.
  const [poseInFlight, setPoseInFlight] = useState(false);
  const prevPoseForFlightRef = useRef(pose);
  if (prevPoseForFlightRef.current !== pose) {
    prevPoseForFlightRef.current = pose;
    if (!poseInFlight) {
      setPoseInFlight(true);
    }
  }
  const stepRef = useRef(step);
  stepRef.current = step;
  // The soft keyboard leaves with its step: the parked seats never
  // unmount, so nothing blurs a text input when a step change slides its
  // panel off show — after Confirm the keyboard would simply stand
  // through the processing beat (Android visibly; the mechanism is the
  // same on iOS). Any crossing away from a system-keyboard step sends it
  // down; a refused entry keeps the step, so inline retry keeps typing.
  // ...and the arrival buzz rides the same step edge — this commit is
  // the one whose layout effect aims the springs, so the buzz and the
  // first moving frame share the beat. Every card arrival speaks (news
  // steps buzz their news through the grammar); of the capsule steps
  // only `done`'s ✓ does — returning to a wait, and the leave, stay
  // silent. The very first step is the opening state, not a transition.
  const prevStepEdgeRef = useRef(step);
  useEffect(() => {
    const prev = prevStepEdgeRef.current;
    prevStepEdgeRef.current = step;
    if (prev === step) {
      return;
    }
    if (prev === 'passphraseOnApp' || prev === 'pairingCode') {
      Keyboard.dismiss();
    }
    if (STEP_POSE[step] === 'card' || step === 'done') {
      fireStepHaptic(step);
    }
  }, [step]);
  const handleGeometrySettled = useCallback(() => {
    setPoseInFlight(false);
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
    pose === 'card' ? (arrangementOf(step) as ICardArrangement) : 'stage',
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
  // warm-up beat. Paused while the box is in flight: every warm build is
  // a one-time main-thread freeze (the reason the ladder exists), and an
  // idle beat landing mid-morph spends that freeze inside the flight's
  // own frame budget. The gate defers the beat, the settle resumes the
  // ladder, and the active arrangement still shows at once regardless
  // (shownPanels below).
  // No warm builds inside a flight's frame budget: both rosters idle
  // through pose flights and resume on the settle.
  const warmIdle = warmEnabled && !poseInFlight;
  const builtPanels = useWarmRoster({
    all: CARD_ARRANGEMENTS,
    active: activeArrangement,
    activeDelayMs: 0,
    idleDelayMs: PANEL_WARM_MS,
    enabled: warmIdle,
  });
  const shownPanels = useMemo(
    () =>
      CARD_ARRANGEMENTS.filter(
        (name) => name === activeArrangement || builtPanels.includes(name),
      ),
    [activeArrangement, builtPanels],
  );

  // Reset epochs for the stateful seats: a parked pad keeps its
  // component state — nothing here ever unmounts — so the epoch stands
  // in for the clean slate a remount used to give.
  //
  // Read on the way OUT, not in. A seat is cleared the moment the step
  // leaves it, because an ask that has ended is spent: the device is no
  // longer listening for its answer, and a secret must not outlive the
  // question. Reading it on the way in could not do this job — the
  // arrangement is frozen while the card is off screen, so leaving a
  // card and returning to the SAME one never read as a change, and the
  // form came back still holding the last entry (OK-59934). Nor would a
  // visit-time reset ever fire for the flows that have no next visit:
  // the answer that was right, the stage the person closed, the device
  // taken away mid-ask. Render-time bump, change-guarded.
  const panelEpochsRef = useRef<Partial<Record<ICardArrangement, number>>>({});
  // The passphrase form also wants to know when it is ENTERED: the exit
  // epoch above fires as the card is left, before the fire-and-forget
  // save of that very exit has broadcast the remembered choice back, so
  // sampling the Keep-accessible seed on it read the value from before
  // the save. The form stays mounted while parked; only a fresh entry
  // should read the preference, and it must read the current one.
  const passphraseEntryEpochRef = useRef(0);
  const prevStepRef = useRef(step);
  if (prevStepRef.current !== step) {
    const leftBehind = panelLeftBehind(prevStepRef.current, step);
    if (step === 'passphraseOnApp') {
      passphraseEntryEpochRef.current += 1;
    }
    prevStepRef.current = step;
    if (leftBehind) {
      panelEpochsRef.current[leftBehind] =
        (panelEpochsRef.current[leftBehind] ?? 0) + 1;
    }
  }
  const passphraseEntryEpoch = passphraseEntryEpochRef.current;
  const pinEpoch = panelEpochsRef.current.pinOnApp ?? 0;
  const introEpoch = panelEpochsRef.current.passphraseIntro ?? 0;
  const passphraseEpoch = panelEpochsRef.current.passphraseOnApp ?? 0;
  const pairingEpoch = panelEpochsRef.current.pairingCode ?? 0;
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
  // The stage seat speaks for whichever staged step is (or last was) on
  // show — tracked off the live step, so a parked stage snaps its words
  // during the out beat and the land reveals them already true.
  // Render-time ref write on purpose: read in the same pass, idempotent.
  const stageWordsRef = useRef<IDeviceStageStep>(
    REPLICA_PORT[step] ? step : 'enterPin',
  );
  if (REPLICA_PORT[step]) {
    stageWordsRef.current = step;
  }
  const stageWordsStep = stageWordsRef.current;
  const stageAnimated = activeArrangement === 'stage' && !reducedMotion;
  // The words' beat only exists while the stage panel is live on show
  // as a card; a pose flight's arrival (hidden or capsule to card) has
  // no out phase to ride, so the tail must snap before the reveal —
  // deferring there paints last visit's tail for a beat.
  const stageTailLive = stageAnimated && !poseInFlight;
  // The tail measure leaves with the content it described: on an arrival
  // that changes the staged step, the stored number is last visit's tail
  // (confirm's payload height under a pin entrance opened the card onto
  // a blank band until the fresh report landed), so it drops in the same
  // render and the arrival aims at words + an absent tail — already
  // exact for the tail-less staged steps. The drop epoch keys the tail
  // block (see the stage panel): exactly the drops force a remount,
  // whose mount report refills the measure even when old and new
  // content land at the same height — and live in-stage moves keep both
  // the number and the subtree: the box must track the content still on
  // show until the words' beat swaps it. Render-phase state adjust on
  // purpose (the poseInFlight pattern above): the same commit's aim
  // must see the drop.
  const prevStageWordsForMeasureRef = useRef(stageWordsStep);
  const stageTailEpochRef = useRef(0);
  if (prevStageWordsForMeasureRef.current !== stageWordsStep) {
    prevStageWordsForMeasureRef.current = stageWordsStep;
    if (!stageTailLive && panelMeasures.stage?.tail !== undefined) {
      stageTailEpochRef.current += 1;
      setPanelMeasures((current) =>
        current.stage?.tail === undefined
          ? current
          : { ...current, stage: { words: current.stage.words } },
      );
    }
  }
  const stageTailEpoch = stageTailEpochRef.current;
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
  // first frame. Flight-paused with the panel ladder above — the same
  // one-time freezes, kept out of the same frame budget.
  const builtScenes = useWarmRoster({
    all: STAGE_SCENES,
    active: activeScene,
    initial: ['connecting'],
    activeDelayMs: 600,
    idleDelayMs: SCENE_WARM_MS,
    enabled: warmIdle,
  });

  // The notice's exit: after a readable hold — counted from the words
  // landing on show — the stage requests close. Ref-called so a driver
  // re-creating its handler never restarts the hold; gated on the grant
  // existing at all — a driver that means the error to auto-leave grants
  // close with it (the notice is terminal, nothing to protect).
  const errorNoticeShown = shownStep === 'error' && !onErrorAction;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeGranted = Boolean(onClose);
  useEffect(() => {
    if (!errorNoticeShown || !closeGranted) {
      return undefined;
    }
    const id = setTimeout(() => onCloseRef.current?.(), ERROR_NOTICE_EXIT_MS);
    return () => clearTimeout(id);
  }, [closeGranted, errorNoticeShown]);

  // The capsule seat is the standing replica's — except under the
  // notice, whose seat is the failure glyph instead. The gate fades the
  // layer on its own quick clock (the label swap it rides carries no
  // shared window for overlay layers) and rests at true 0 there: the
  // device is off duty, its layer released. It is aimed further down,
  // off the FROZEN glyph rather than the live step, so a notice's exit
  // keeps its cleared seat instead of the device ghosting back through
  // the fade; a fresh entrance carries its own reveal, so the gate
  // snaps under it.
  const capsuleSeatShown = useSharedValue(errorNotice ? 0 : 1);

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
    // Layout-free centering: the box's live width in a transform,
    // snapped to the physical pixel grid — Yoga rounds layout but a
    // transform is applied verbatim, and window widths that leave
    // morphWidth - REPLICA_WIDTH odd would otherwise rest the whole
    // replica, screen glyphs included, on a half-point boundary and
    // read as jagged text.
    const centerX =
      Math.round(((morphWidth.value - REPLICA_WIDTH) / 2) * PIXEL_GRID) /
      PIXEL_GRID;
    if (progress.value < SEAT_SWAP_AT) {
      return {
        // The seat gate scales the whole window, floor included: under
        // the notice the device is truly off duty, so its layer rests
        // at 0 and releases.
        opacity:
          Math.max(
            interpolate(
              progress.value,
              [0, PILL_OUT_END],
              [1, 0],
              Extrapolation.CLAMP,
            ),
            REPLICA_HOLD_ALPHA,
          ) * capsuleSeatShown.value,
        transform: [{ translateX: centerX }, { translateY: -REPLICA_TOP }],
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
      transform: [{ translateX: centerX }, { translateY: 0 }],
    };
  }, [capsuleSeatShown, morphWidth, progress, replicaShown, swapFade]);
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
  // seat speaks for stageWordsStep (tracked above the measures); a
  // crossing's outgoing side keeps its own words because its seat
  // simply is not the one changing. App seats own their words outright;
  // the pieces that vary (the passphrase title, the error copy) snap
  // while parked, as StepText animates on the active seat alone.
  const intl = useIntl();
  const errorCopy = ERROR_TEXT[errorReason ?? 'generic'];
  const localizedErrorMessage = resolveErrorMessage(
    intl,
    errorMessage,
    errorI18n,
  );
  const stageText = resolveStageText(intl, stageWordsStep);
  const passphraseText = resolvePassphrasePanelText(intl, passphraseMode);
  const appStepSub = useMemo(
    () => ({
      pinOnApp: resolveStepSub(intl, 'pinOnApp'),
      showQr: resolveStepSub(intl, 'showQr'),
      scanQr: resolveStepSub(intl, 'scanQr'),
    }),
    [intl],
  );

  // enterPin's switch back to app entry (OK-61489). Confirmed lives per
  // CARD STAY, not per mount: the production surface is permanently
  // mounted, so a once-only flag would pin the set-to-app banner onto
  // every later enterPin card (the app-pad hop's card wore a stale
  // banner) and swallow the entry after the person switches the setting
  // back. Within one stay the entry must not re-offer itself; when the
  // step leaves, the flag resets and the next card's wiring decides
  // eligibility afresh.
  const [pinSwitchDone, setPinSwitchDone] = useState(false);
  useEffect(() => {
    // Keyed to the LIVE step, not stageWordsStep: the stage panel's
    // words freeze while another panel (the app pad) is up, so the
    // parked value would still read 'enterPin' and never reset.
    if (step !== 'enterPin') {
      setPinSwitchDone(false);
    }
  }, [step]);
  const pinSwitchBusyRef = useRef(false);
  const handleSwitchPinToApp = useCallback(async () => {
    if (pinSwitchBusyRef.current) {
      return;
    }
    pinSwitchBusyRef.current = true;
    try {
      await onSwitchPinInputToApp?.();
      setPinSwitchDone(true);
    } catch {
      // The write failed; the entry line stays for another try.
    } finally {
      pinSwitchBusyRef.current = false;
    }
  }, [onSwitchPinInputToApp]);
  const pinSwitchOffered =
    stageWordsStep === 'enterPin' &&
    Boolean(onSwitchPinInputToApp) &&
    !pinSwitchDone;
  const pinSwitchSlot = useMemo(
    () =>
      pinSwitchOffered ? (
        <Stack
          alignSelf="flex-start"
          cursor="default"
          onPress={handleSwitchPinToApp}
          pressStyle={PIN_SWITCH_PRESS}
          hitSlop={PIN_SWITCH_HIT_SLOP}
          testID="device-stage-pin-switch-entry"
        >
          <SizableText
            size="$bodyMd"
            color="$textInteractive"
            cursor="default"
            hoverStyle={PIN_SWITCH_HOVER}
          >
            {intl.formatMessage({
              id: ETranslations.device_stage_prefer_pin_in_app__action,
            })}
          </SizableText>
        </Stack>
      ) : null,
    [handleSwitchPinToApp, intl, pinSwitchOffered],
  );
  const pinSwitchBannerShown = stageWordsStep === 'enterPin' && pinSwitchDone;
  // The third-party cards' runtime words: brand, app name, path.
  const deviceNotFoundText = useMemo(
    () => resolveDeviceNotFoundText(intl, vendor),
    [intl, vendor],
  );
  const btcHighIndexSub = useMemo(
    () =>
      resolveBtcHighIndexSub(intl, btcHighIndexPath, btcHighIndexAccountIndex),
    [btcHighIndexAccountIndex, btcHighIndexPath, intl],
  );
  const installConfirmText = useMemo(
    () => resolveInstallText(intl, 'installConfirm', appName),
    [appName, intl],
  );
  const installingText = useMemo(
    () => resolveInstallText(intl, 'installing', appName),
    [appName, intl],
  );
  const pairingCodeText = useMemo(() => resolvePairingCodeText(intl), [intl]);
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
  const passphraseAnimated =
    activeArrangement === 'passphraseOnApp' && !reducedMotion;
  const errorAnimated = activeArrangement === 'error' && !reducedMotion;
  const stageChecklistShown = useStageTailFlag(
    (stageWordsStep === 'authVerifying' || stageWordsStep === 'authSuccess') &&
      Boolean(authChecklist?.length),
    stageTailLive,
  );
  // Confirm's payload card rides the same beat: on show together with
  // the confirm words, never a delayed second landing — the tail's
  // height re-aim already carries it, so entering confirm grows the box
  // straight to its full size in one move. Any of the three content
  // shapes summons it; the count pill rides its beat, it never calls
  // the card up alone.
  const confirmCardShown = useStageTailFlag(
    stageWordsStep === 'confirm' &&
      Boolean(confirmDetails?.length || confirmMessage || confirmDescription),
    stageTailLive,
  );
  // The capsule keeps its own last words while another pose plays, so
  // the (invisible) row never re-measures against a card title and the
  // size springs always aim at true capsule content. Render-time ref
  // write on purpose: the read is in the same pass and the write is
  // idempotent.
  const capsuleTextRef = useRef(
    resolveCapsuleText(intl, 'connecting', deviceName, vendor),
  );
  // The capsule's glyph seat freezes on the same clock as its words: the
  // vendor's product shot for the device beats, the ✓ for `done`, the ✗
  // for the notice, the Bluetooth badge for the wireless waits.
  const capsuleGlyphRef = useRef<'device' | 'done' | 'error' | 'bluetooth'>(
    'device',
  );
  if (pose === 'capsule') {
    // Straight off the live step: the column's words freeze on card
    // steps, but the capsule always speaks the present.
    capsuleTextRef.current = resolveCapsuleText(
      intl,
      step,
      deviceName,
      vendor,
      errorReason,
      localizedErrorMessage,
    );
    if (errorNotice) {
      capsuleGlyphRef.current = 'error';
    } else if (vendor) {
      capsuleGlyphRef.current = step === 'done' ? 'done' : 'device';
    } else {
      // The wireless waits — connecting and processing alike — wear the
      // Bluetooth badge in the device seat: the replica steps aside
      // through the seat gate below, the way it does for the notice's
      // ✗. The wired wait IS the replica: the plugged-in device
      // standing there.
      capsuleGlyphRef.current =
        (step === 'connecting' || step === 'processing') &&
        connectionType === 'bluetooth'
          ? 'bluetooth'
          : 'device';
    }
  }
  const capsuleText = capsuleTextRef.current;
  const capsuleGlyph = capsuleGlyphRef.current;

  // The seat gate's aim (declared with the notice logic above): the
  // frozen glyph decides the seat on the capsule's own clock, so the
  // exit keeps whatever the capsule last showed.
  const capsuleSeatCleared =
    capsuleGlyph === 'error' || capsuleGlyph === 'bluetooth';
  useEffect(() => {
    const target = capsuleSeatCleared ? 0 : 1;
    if (reducedMotion || sceneEntryInstant) {
      capsuleSeatShown.value = target;
      return;
    }
    capsuleSeatShown.value = withTiming(target, {
      duration: CAPSULE_SEAT_FADE_MS,
      easing: easeOutFn,
    });
  }, [capsuleSeatCleared, capsuleSeatShown, reducedMotion, sceneEntryInstant]);

  /* The parked columns, one per arrangement — each element memoized on
   * its own inputs, so a step change re-renders only the seats it
   * touched and every other parked column bails by identity. */
  // The title's pill: the device's name, riding the title's line when
  // the two fit side by side and dropping under it otherwise (StepText's
  // wrapping title row) — worn only by the device-side steps, where the
  // person must reach for the physical device the pill names.
  const deviceBadge = useMemo(() => {
    if (!deviceName || !DEVICE_BADGE_STEPS.has(shownStep)) {
      return null;
    }
    return (
      <Stack borderRadius="$full" bg="$neutral4" px="$2.5" py="$1">
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          {deviceName}
        </SizableText>
      </Stack>
    );
  }, [deviceName, shownStep]);

  const stagePanel = useMemo(() => {
    return (
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
                  subSlot={pinSwitchSlot}
                  titleSlot={deviceBadge}
                />
              </Stack>
              {/* The count pill — this burst's place in a run — rides
                  the payload card's beat, so the title and its
                  furniture land together. */}
              {confirmCount && confirmCardShown ? (
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
              ) : null}
            </XStack>
          </View>
        </Animated.View>
        {/* Keyed by the drop epoch: exactly the stale-measure drops
            force a remount, whose mount report refills the measure even
            at an equal height — live moves never rebuild the tail. */}
        <View key={stageTailEpoch} onLayout={panelMeasureHandlers.stage.tail}>
          {/* The authenticity checklist rides the staged words the way
              confirm's payload card does — under them, on the same
              surface, its rows advanced by the driver; its presence
              flips on the words' beat (see stageChecklistShown). */}
          {stageChecklistShown && authChecklist?.length ? (
            <AuthChecklist items={authChecklist} />
          ) : null}
          {confirmCardShown ? (
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
          ) : null}
          {/* The set-to-app banner (OK-61489): the entry line's landing
              state, in the tail the way confirm's payload card rides —
              the switch is written, this request still ends on the
              device. */}
          {pinSwitchBannerShown ? (
            <XStack
              borderRadius="$6"
              borderCurve="continuous"
              bg="$neutral2"
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="$neutral4"
              px="$4"
              py="$3"
              gap="$2"
              ai="flex-start"
            >
              <Stack mt="$0.5">
                <Icon
                  name="Checkmark2Solid"
                  size="$4"
                  color="$textInteractive"
                />
              </Stack>
              <YStack flex={1} gap="$1">
                <SizableText size="$bodyMd" color="$textInteractive">
                  {intl.formatMessage({
                    id: ETranslations.device_stage_pin_set_to_app__title,
                  })}
                </SizableText>
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.device_stage_pin_set_to_app__desc,
                  })}
                </SizableText>
              </YStack>
            </XStack>
          ) : null}
        </View>
      </YStack>
    );
  }, [
    authChecklist,
    confirmCardShown,
    confirmCount,
    confirmDescription,
    confirmDescriptionDanger,
    confirmDetails,
    confirmMessage,
    intl,
    panelMeasureHandlers,
    pinSwitchBannerShown,
    pinSwitchSlot,
    deviceBadge,
    spacerFlowStyle,
    stageAnimated,
    stageChecklistShown,
    stageTailEpoch,
    stageText,
    wordsStyle,
  ]);
  const pinPanel = useMemo(
    () => (
      <YStack>
        <View onLayout={panelMeasureHandlers.pinOnApp.words}>
          <StepText
            title={intl.formatMessage({ id: STEP_TEXT.pinOnApp.title })}
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
      intl,
      onPinSubmit,
      onSwitchToDevice,
      panelMeasureHandlers,
      pinEpoch,
      vendor,
    ],
  );
  const selectWalletTypePanel = useMemo(
    () => (
      <YStack>
        <View onLayout={panelMeasureHandlers.selectWalletType.words}>
          <StepText
            title={intl.formatMessage({
              id: STEP_TEXT.selectWalletType.title,
            })}
            sub=""
            animated={false}
          />
        </View>
        <View onLayout={panelMeasureHandlers.selectWalletType.tail}>
          {onSelectWalletType ? (
            <WalletTypeOptions onSelect={onSelectWalletType} />
          ) : null}
        </View>
      </YStack>
    ),
    [intl, onSelectWalletType, panelMeasureHandlers],
  );
  const passphraseIntroPanel = useMemo(
    () => (
      <YStack>
        <View onLayout={panelMeasureHandlers.passphraseIntro.words}>
          <StepText
            title={intl.formatMessage({ id: STEP_TEXT.passphraseIntro.title })}
            sub=""
            animated={false}
          />
        </View>
        <View onLayout={panelMeasureHandlers.passphraseIntro.tail}>
          <PassphraseIntro
            onContinue={onPassphraseIntroContinue}
            resetSignal={introEpoch}
            keepShortcutDefault={passphraseIntroKeepShortcut}
          />
        </View>
      </YStack>
    ),
    [
      intl,
      introEpoch,
      onPassphraseIntroContinue,
      panelMeasureHandlers,
      passphraseIntroKeepShortcut,
    ],
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
            initialKeepAccessible={passphraseKeepAccessible}
            allowProtocolV2Utf8={passphraseAllowUtf8}
            activationSignal={passphraseEntryEpoch}
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
      passphraseAllowUtf8,
      passphraseEntryEpoch,
      passphraseEpoch,
      passphraseKeepAccessible,
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
            title={intl.formatMessage({ id: STEP_TEXT.showQr.title })}
            sub={appStepSub.showQr}
            animated={false}
          />
        </View>
        <View onLayout={panelMeasureHandlers.showQr.tail}>
          <QrPresent value={qrValue} valueUr={qrValueUr} onNext={onQrNext} />
        </View>
      </YStack>
    ),
    [
      appStepSub.showQr,
      intl,
      onQrNext,
      panelMeasureHandlers,
      qrValue,
      qrValueUr,
    ],
  );
  const scanQrPanel = useMemo(
    () => (
      <YStack>
        <View onLayout={panelMeasureHandlers.scanQr.words}>
          <StepText
            title={intl.formatMessage({ id: STEP_TEXT.scanQr.title })}
            sub={appStepSub.scanQr}
            animated={false}
          />
        </View>
        <View onLayout={panelMeasureHandlers.scanQr.tail}>
          <QrScanFrame onBack={onQrBack} scannerView={qrScannerView} />
        </View>
      </YStack>
    ),
    [appStepSub.scanQr, intl, onQrBack, panelMeasureHandlers, qrScannerView],
  );
  const authFailurePanel = useMemo(
    () => (
      <YStack>
        {/* The card fronts its icon above its own words, so the whole
            column is the words block; the tail stands empty. */}
        <View onLayout={panelMeasureHandlers.authFailure.words}>
          <AuthFailureCard
            reason={authFailureReason}
            checklist={authChecklist}
            onSupport={onAuthSupport}
            onRetry={onAuthRetry}
            allowDevSkip={allowAuthDevSkip}
            onContinueAnyway={onAuthContinueAnyway}
            resetSignal={authFailureEpoch}
          />
        </View>
        <View onLayout={panelMeasureHandlers.authFailure.tail} />
      </YStack>
    ),
    [
      authChecklist,
      authFailureReason,
      authFailureEpoch,
      allowAuthDevSkip,
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
            title={
              // Same rule as the notice: the failure's own words when no
              // reason claims it, the reason's considered wording when
              // one does.
              !errorReason && localizedErrorMessage
                ? localizedErrorMessage
                : intl.formatMessage({ id: errorCopy.title })
            }
            sub={intl.formatMessage({ id: errorCopy.sub })}
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
              {intl.formatMessage({ id: errorCopy.action })}
            </Button>
          ) : null}
        </View>
      </YStack>
    ),
    [
      errorAnimated,
      errorCopy,
      errorReason,
      intl,
      localizedErrorMessage,
      onErrorAction,
      panelMeasureHandlers,
    ],
  );
  const pairingCodePanel = useMemo(
    () => (
      <YStack>
        <View onLayout={panelMeasureHandlers.pairingCode.words}>
          <StepText
            title={pairingCodeText.title}
            sub={pairingCodeText.sub}
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
    [onPairingSubmit, pairingCodeText, pairingEpoch, panelMeasureHandlers],
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
          {onDeviceNotFoundRetry ||
          onDeviceNotFoundTroubleshoot ||
          onDeviceNotFoundSupport ? (
            <YStack gap="$2">
              {onDeviceNotFoundRetry ? (
                <Button
                  testID="device-stage-device-not-found-confirm"
                  variant="primary"
                  size="large"
                  onPress={onDeviceNotFoundRetry}
                >
                  {intl.formatMessage({ id: ETranslations.global_confirm })}
                </Button>
              ) : null}
              {/* The current UI's own self-check pair: the help-center
                  article (open-in — it leaves the app) and Support. */}
              {onDeviceNotFoundTroubleshoot ? (
                <Button
                  testID="device-stage-device-not-found-troubleshoot"
                  size="large"
                  icon="OpenOutline"
                  onPress={onDeviceNotFoundTroubleshoot}
                >
                  {intl.formatMessage({
                    id: ETranslations.self_troubleshooting,
                  })}
                </Button>
              ) : null}
              {onDeviceNotFoundSupport ? (
                <Button
                  testID="device-stage-device-not-found-contact-us"
                  size="large"
                  icon="HelpSupportOutline"
                  onPress={onDeviceNotFoundSupport}
                >
                  {intl.formatMessage({
                    id: ETranslations.settings_contact_us,
                  })}
                </Button>
              ) : null}
            </YStack>
          ) : null}
        </View>
      </YStack>
    ),
    [
      deviceNotFoundText,
      intl,
      onDeviceNotFoundRetry,
      onDeviceNotFoundSupport,
      onDeviceNotFoundTroubleshoot,
      panelMeasureHandlers,
    ],
  );
  const btcHighIndexPanel = useMemo(
    () => (
      <YStack>
        <View onLayout={panelMeasureHandlers.btcHighIndex.words}>
          <StepText
            title={intl.formatMessage({ id: STEP_TEXT.btcHighIndex.title })}
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
              {intl.formatMessage({ id: ETranslations.global_confirm })}
            </Button>
          ) : null}
        </View>
      </YStack>
    ),
    [btcHighIndexSub, intl, onBtcHighIndexConfirm, panelMeasureHandlers],
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
              {intl.formatMessage({ id: ETranslations.global_install })}
            </Button>
          ) : null}
        </View>
      </YStack>
    ),
    [installConfirmText, intl, onInstallConfirm, panelMeasureHandlers],
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
            title={intl.formatMessage({ id: STEP_TEXT.installBatch.title })}
            sub={resolveStepSub(intl, 'installBatch')}
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
    [
      installActiveIndex,
      installProgress,
      installQueue,
      intl,
      panelMeasureHandlers,
    ],
  );
  const panelByArrangement: Record<ICardArrangement, ReactNode> = useMemo(
    () => ({
      stage: stagePanel,
      pinOnApp: pinPanel,
      selectWalletType: selectWalletTypePanel,
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
      selectWalletTypePanel,
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
          // Also paused through the pose flight: the scene clock drives
          // its keyframe worklets every frame, a fixed tax the flight's
          // budget can't spare — and the glass is fading through the
          // cross-fade gap then anyway. Settling restarts the schedule
          // from its opening still, the parked-scene grammar.
          paused={hidden || poseInFlight}
        />
      </View>
    ),
    [
      activeScene,
      builtScenes,
      deviceType,
      handleDeviceLayout,
      hidden,
      poseInFlight,
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

  // The ripple rests through pose flights too: the capsule pose stands
  // from a return flight's first frame, and an infinite loop has no
  // business inside the flight's frame budget. One flag, so the capsule
  // row only rebuilds when a mounted badge's rest state actually flips
  // — never for a flight settling over the other glyphs.
  const bluetoothBadgePaused =
    capsuleGlyph !== 'bluetooth' || pose !== 'capsule' || poseInFlight;
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
          devices have no replica to seat here. The notice fills it with
          the failure ✗ on both tracks, and the wireless waits
          (connecting and processing) with the Bluetooth badge — the
          seat gate clears the replica for both (the wired waits keep
          the replica: the plugged-in device itself). */}
        <Stack
          width={CAPSULE_ROW.thumbBox}
          height={CAPSULE_ROW.thumbBox}
          alignItems="center"
          justifyContent="center"
        >
          {capsuleGlyph === 'done' ? (
            <Icon name="CheckRadioSolid" size="$6" color="$iconSuccess" />
          ) : null}
          {capsuleGlyph === 'error' ? (
            <Icon name="XCircleSolid" size="$6" color="$iconCritical" />
          ) : null}
          {capsuleGlyph === 'bluetooth' ? (
            <BluetoothBadge paused={bluetoothBadgePaused} />
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
            its per-frame band nor resume it mid-glide. It rests under
            the notice too — the sweep is a waiting affordance, and the
            notice waits for nothing. */}
          <ShimmerTitle paused={pose !== 'capsule' || capsuleGlyph === 'error'}>
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
    [bluetoothBadgePaused, capsuleGlyph, capsuleText, pose, vendorImageSource],
  );

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
  IDeviceStageWalletType,
} from './type';
