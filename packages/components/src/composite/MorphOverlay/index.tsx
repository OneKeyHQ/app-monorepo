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

import { easeInFn, easeOutFn } from '../../content/deviceScene';
import { Portal } from '../../hocs';
import { useSafeAreaInsets } from '../../hooks';
import { Stack } from '../../primitives';

import type { LayoutChangeEvent } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

/**
 * The morphing overlay: one dark container floating over the app,
 * resting as a capsule when nothing is asked of the person and blooming
 * into a card when something is — the breathing is the point. It owns
 * the surface itself: the pose springs, the measured rest sizes, the
 * presence door, the keyboard ride, and the two-phase crossing that
 * swaps one card content for another on an empty beat. What the poses
 * SAY is the caller's business entirely — content arrives as slots
 * (capsule row, parked card seats, an optional under-content stage
 * layer), and callers with animated flow of their own ride the same
 * clock through `onAim` (see DeviceStage, the container's one tenant
 * and the reason it exists).
 *
 * Geometry runs as one spring per axis on a single node. Pose flips
 * cross-fade the capsule and card contents on the morph's progress;
 * card-to-card changes keep the pose and morph only the height while
 * the contents cross-fade on `swapFade`. Crossings are springs re-aimed
 * mid-flight.
 *
 * Split as a hook + view pair on purpose: `useMorphOverlay` owns the
 * state (springs, crossing machine, capsule measurement) so the caller
 * can read `shown` and the motion values while building its slots; the
 * `MorphOverlay` view then takes the assembled slots plus the caller's
 * per-render targets and aims everything in one layout effect — one
 * commit, one frame, content and geometry always landing together.
 *
 * Still out of scope until ratified: drag gestures and accessibility
 * focus. Judge springs in a release build — dev-mode JS load slanders
 * the engine.
 */

export type IMorphOverlayPose = 'hidden' | 'capsule' | 'card';

/**
 * One thing the overlay can hold: the caller's live value, the rest
 * pose it belongs to, and the key whose change means "different card
 * content" — a crossing. Values sharing a key swap live in place;
 * values with different keys run the two-phase swap. `value` should be
 * reference-comparable (a string step, a stable object): the crossing
 * machine holds and compares it by identity.
 */
export interface IMorphOverlayContent<T> {
  value: T;
  pose: IMorphOverlayPose;
  key: string;
}

/**
 * The aiming facts handed to `onAim`, for callers whose content carries
 * animated flow of its own (spacers, ports) that must land or move on
 * the container's own clock: `snap` lands everything in one piece
 * (reduced motion, or an entrance appearing already at its pose);
 * `landInPlace` marks a commit that lands new card content — a pose
 * arrival or a crossing's empty beat — where in-content values must
 * jump, not animate; otherwise a live in-card change rides
 * `ARRANGE_MS`. Called synchronously inside the container's own layout
 * effect, so every shared-value write lands on the same frame as the
 * container's springs.
 */
export interface IMorphAimFacts {
  snap: boolean;
  card: boolean;
  landInPlace: boolean;
}

/** The stage's opaque near-black face, and the alpha ramp over it —
 * content painting fades over the face (fog, scrims) derives from these
 * so the compositing stays pixel-identical to the face itself. */
export const STAGE_BG = '#0A0A0C';
export function stageBgAlpha(alpha: number): string {
  return `rgba(10,10,12,${alpha})`;
}

/* ----------------------------- tuning knobs ----------------------------- */

/** The resting capsule's own geometry: clearance from the layer's bottom
 * edge (the spec floats it clear), and first-frame stand-ins corrected
 * by the capsule row's first layout report. The row's paddings and
 * content are the caller's — whatever it renders IS the capsule, radius
 * pinned to height/2, a true capsule. */
const PILL_REST = {
  lift: 32,
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
export const CARD = {
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

/**
 * One spring for every geometry axis, so the morph reads as one gesture.
 * Tuned toward the system sheet's feel: settles ~600ms with a breath of
 * life, no visible wobble.
 */
const MORPH_SPRING = { mass: 1, stiffness: 230, damping: 26 };

/** Content fade windows on the capsule↔card progress. The capsule leaves
 * early (its drift while the box grows must stay imperceptible); the card
 * arrives across the back half, riding a slight scale-up. Exported so
 * content layers riding the same window (a stage layer that jumps
 * between seats) can time themselves against it. */
export const PILL_OUT_END = 0.25;
export const CARD_IN_START = 0.45;
const CARD_IN_SCALE_FROM = 0.92;

/** The capsule row's in-place word swap (same pose, new capsule key). */
const CAPSULE_SWAP_IN_MS = 200;
const CAPSULE_SWAP_IN_DELAY_MS = 80;
const CAPSULE_SWAP_OUT_MS = 120;

/* ------------------------ the crossing grammar ------------------------ *
 * Card-to-card changes with the same key flow live: the caller's own
 * words swap in place, in-card moves ride the arrangement clock. A
 * change of key runs the two-phase swap: the outgoing side fades out on
 * the out beat, the content and the height target land together on the
 * empty beat — in one piece, so the box re-aims exactly once, while
 * nothing is on show — and the incoming side fades in whole on the in
 * beat. The swap clock is the container's one word-swap grammar: text
 * blocks swapping inside a card (see DeviceStage's StepText) run the
 * same two phases with the same easings, so words and crossings always
 * agree. */
export const SWAP_OUT_MS = 200;
export const SWAP_IN_MS = 280;

/** The clock in-card arrangement moves ride — content flow re-aimed
 * through `onAim`, and the height when a live in-card move drives it
 * (see `heightArrangeToken`). */
export const ARRANGE_MS = 560;
export const arrangeEase = Easing.bezierFn(0.4, 0, 0.2, 1);

/** Extra travel past the shell's own height when it sinks off the edge,
 * covering the lift and the home-indicator band. */
const EXIT_OVERSHOOT = 80;

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
  // Every seat spans the card's width at its top and carries the card's
  // own content inset, so seat columns start below the grabber band and
  // inside the side padding by construction. Height hugs its own column.
  // Hidden seats stay laid out — their measures keep the height targets
  // honest — they just show and touch nothing.
  panelSeat: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: CARD.padTop,
    paddingLeft: CARD.pad,
    paddingRight: CARD.pad,
  },
  panelSeatHidden: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: CARD.padTop,
    paddingLeft: CARD.pad,
    paddingRight: CARD.pad,
    opacity: 0,
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

export interface IMorphOverlayState<T> {
  /** The live pose — geometry follows it directly. */
  pose: IMorphOverlayPose;
  /** What the card shows: the held value through a crossing's out beat,
   * the live one otherwise. Content-side rendering reads this. */
  shown: T;
  shownKey: string;
  /** The two-phase branch fade over the card contents: 1 whenever no
   * crossing is in flight. */
  swapFade: SharedValue<number>;
  /** Capsule↔card content window: 0 at the capsule, 1 at the card. */
  progress: SharedValue<number>;
  /** The geometry springs, published for content layers that position
   * against the container's box (a centered stage layer needs the live
   * width; the rest are the view's own). */
  width: SharedValue<number>;
  height: SharedValue<number>;
  radius: SharedValue<number>;
  lift: SharedValue<number>;
  presence: SharedValue<number>;
  /** The capsule row's measured rest size (estimates until the first
   * layout report). */
  pillSize: { width: number; height: number };
  reducedMotion: boolean;
  /** @internal wiring between the hook and the view. */
  onPillLayout: (event: LayoutChangeEvent) => void;
}

/**
 * The overlay's state: the crossing machine, the geometry springs and
 * the capsule measurement. Call it first, build the slots off `shown`
 * and the motion values, then hand everything to `<MorphOverlay/>`.
 */
export function useMorphOverlay<T>(
  live: IMorphOverlayContent<T>,
): IMorphOverlayState<T> {
  const reducedMotion = useReducedMotion();

  // The crossing machine: a change of key holds the shown value while
  // the outgoing side fades on the out beat, lands it on the empty beat
  // — content and height target together, in one piece — then reveals
  // on the in beat. Pose flips bypass the machine: the pose windows
  // carry those changes.
  const [held, setHeld] = useState<IMorphOverlayContent<T>>(live);
  const crossing =
    live.pose === 'card' && held.pose === 'card' && held.key !== live.key;
  const shown = crossing ? held : live;
  const targetRef = useRef(live);
  targetRef.current = live;
  const swapFade = useSharedValue(1);
  // Only lands the value; the reveal happens in the effect below, AFTER
  // the landed content has committed (a shared-value write issued next
  // to the setState reaches the UI thread a frame early).
  const land = useCallback(() => {
    setHeld(targetRef.current);
  }, []);
  const { key: liveKey, pose: livePose, value: liveValue } = live;
  useEffect(() => {
    const heldIsLive =
      Object.is(held.value, liveValue) &&
      held.key === liveKey &&
      held.pose === livePose;
    if (livePose !== 'card') {
      // The card is not on show: land silently, the pose windows carry
      // whatever changed.
      cancelAnimation(swapFade);
      swapFade.value = 1;
      if (!heldIsLive) {
        setHeld({ value: liveValue, pose: livePose, key: liveKey });
      }
      return;
    }
    if (heldIsLive) {
      // The reveal after a landing — and the re-aim that heals an
      // interrupted out-phase, so the card can never stay half-lit. A
      // fade already resting at 1 needs neither, and skipping it spares
      // every swapFade-driven style a no-op timing's worth of frames.
      cancelAnimation(swapFade);
      if (swapFade.value === 1) {
        return;
      }
      if (reducedMotion) {
        swapFade.value = 1;
        return;
      }
      swapFade.value = withTiming(1, {
        duration: SWAP_IN_MS,
        easing: easeOutFn,
      });
      return;
    }
    if (held.key === liveKey) {
      // Same key: `shown` already follows the live value — this only
      // keeps the bookkeeping current.
      setHeld({ value: liveValue, pose: livePose, key: liveKey });
      return;
    }
    if (reducedMotion) {
      cancelAnimation(swapFade);
      swapFade.value = 1;
      setHeld({ value: liveValue, pose: livePose, key: liveKey });
      return;
    }
    cancelAnimation(swapFade);
    swapFade.value = withTiming(
      0,
      { duration: SWAP_OUT_MS, easing: easeInFn },
      (finished) => {
        if (finished) runOnJS(land)();
      },
    );
  }, [held, land, liveKey, livePose, liveValue, reducedMotion, swapFade]);

  // Both rest poses hug their content: the capsule row (paddings of its
  // own, so its box IS the capsule) and the active card column each
  // report their natural size and the springs re-aim to the measured
  // rests. The estimates only cover the first frames of a fresh pose.
  const [pillSize, setPillSize] = useState<{ width: number; height: number }>({
    width: PILL_REST.estimatedWidth,
    height: PILL_REST.estimatedHeight,
  });
  const onPillLayout = useCallback((event: LayoutChangeEvent) => {
    const { width: rowWidth, height: rowHeight } = event.nativeEvent.layout;
    const next = { width: Math.ceil(rowWidth), height: Math.ceil(rowHeight) };
    // Same box, same state: capsule word swaps remount the keyed row and
    // re-report, and an unchanged measurement should not re-render the
    // whole stage or re-aim settled springs.
    setPillSize((current) =>
      current.width === next.width && current.height === next.height
        ? current
        : next,
    );
  }, []);

  // One spring per geometry axis, re-aimed together on every pose or
  // measurement change — not a single progress interpolation, which would
  // snap card-to-card height changes instead of springing them (with the
  // pose held, a progress spring has nowhere left to travel). `progress`
  // survives only as the content fade window between the two poses;
  // `presence` is the whole shell's being-there, the hidden pose's axis.
  // Rest values are estimates; the view's first layout effect lands the
  // real pose targets before anything paints.
  const width = useSharedValue(PILL_REST.estimatedWidth);
  const height = useSharedValue(PILL_REST.estimatedHeight);
  const radius = useSharedValue(PILL_REST.estimatedHeight / 2);
  const lift = useSharedValue(PILL_REST.lift);
  const progress = useSharedValue(live.pose === 'card' ? 1 : 0);
  const presence = useSharedValue(live.pose === 'hidden' ? 0 : 1);

  return {
    pose: live.pose,
    shown: shown.value,
    shownKey: shown.key,
    swapFade,
    progress,
    width,
    height,
    radius,
    lift,
    presence,
    pillSize,
    reducedMotion,
    onPillLayout,
  };
}

export interface IMorphOverlayProps<T> {
  morph: IMorphOverlayState<T>;
  /** The shown card column's own height — the caller's measured blocks,
   * chrome excluded; the container adds its own padding and chin. */
  cardInnerHeight: number;
  /**
   * Whether that height is real yet. A crossing lands content and height
   * target together because the incoming content was measured while
   * parked; only cold content has no numbers on its land commit, and
   * aiming there would dip the box toward a phantom target — so that one
   * defers to the first report, a frame later, still inside the empty
   * beat.
   */
  cardContentMeasured: boolean;
  /**
   * The live in-card move the height should ride `ARRANGE_MS` for
   * instead of the spring: while the card stays put and this token
   * changes between two defined values, the height runs on the
   * arrangement clock (DeviceStage passes its staged port height — the
   * confirm shrink and back). Undefined-to-value edges keep the spring.
   */
  heightArrangeToken?: number;
  /** The caller's own flow aimed on the container's clock — see
   * IMorphAimFacts. Its identity is an effect dependency on purpose:
   * wrap it in useCallback over the flow targets, and a target change
   * re-aims. */
  onAim?: (facts: IMorphAimFacts) => void;
  /** Keyed capsule row: a key change swaps the row in place with a fade
   * — the capsule itself never moves. */
  capsuleKey: string;
  capsule: ReactNode;
  /** Optional layer between the face and the card seats — content that
   * must composite under the seats but over the face (DeviceStage's
   * standing replica). */
  stageLayer?: ReactNode;
  /** The parked card columns. Seats never mount or unmount with the
   * shown step — parking is the caller's warm-up policy — and exactly
   * one is active. */
  seats: Array<{ key: string; active: boolean; node: ReactNode }>;
}

export function MorphOverlay<T>({
  morph,
  cardInnerHeight,
  cardContentMeasured,
  heightArrangeToken,
  onAim,
  capsuleKey,
  capsule,
  stageLayer,
  seats,
}: IMorphOverlayProps<T>) {
  const {
    pose,
    shownKey,
    swapFade,
    progress,
    width,
    height,
    radius,
    lift,
    presence,
    pillSize,
    reducedMotion,
    onPillLayout,
  } = morph;
  const { width: screenWidth } = useWindowDimensions();
  const { bottom: safeBottom } = useSafeAreaInsets();
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
  const cardHeight = CARD.padTop + cardInnerHeight + cardBottomPad;
  // A launch-time device constant; memoized only to skip the Settings
  // read on re-renders.
  const cardRadius = useMemo(() => {
    const screenCornerRadius = getDisplayCornerRadius();
    return screenCornerRadius ? screenCornerRadius - CARD.margin : CARD.radius;
  }, []);

  const prevPoseRef = useRef(pose);
  const prevKeyRef = useRef(shownKey);
  const prevTokenRef = useRef(heightArrangeToken);
  const firstRunRef = useRef(true);
  // Layout effect on purpose: the springs are aimed before this commit
  // paints, so the first morph frame ships with the driver's own
  // re-render instead of one frame behind it — and the mount lands its
  // pose targets before the estimates ever paint.
  useLayoutEffect(() => {
    const prevPose = prevPoseRef.current;
    prevPoseRef.current = pose;
    const prevKey = prevKeyRef.current;
    prevKeyRef.current = shownKey;
    const prevToken = prevTokenRef.current;
    prevTokenRef.current = heightArrangeToken;
    const first = firstRunRef.current;
    firstRunRef.current = false;
    if (pose === 'hidden') {
      // The shell leaves the way the system sheet does: it sinks whole
      // below the bottom edge, opaque all the way. Geometry holds, so
      // the slide never doubles as a shrink.
      presence.value = first || reducedMotion ? 0 : withSpring(0, MORPH_SPRING);
      return;
    }
    const card = pose === 'card';
    const targets = {
      width: card ? cardWidth : pillSize.width,
      height: card ? cardHeight : pillSize.height,
      // A capsule's radius tracks its own height — always half of it.
      radius: card ? cardRadius : pillSize.height / 2,
      lift: card ? CARD.margin : PILL_REST.lift,
      progress: card ? 1 : 0,
    };
    // An entrance appears already at its pose — geometry snaps while the
    // shell is still invisible, then presence carries the arrival. The
    // very first run is the mount landing on whatever pose it opened at.
    const arriving = prevPose === 'hidden';
    if (first || reducedMotion || arriving) {
      width.value = targets.width;
      height.value = targets.height;
      radius.value = targets.radius;
      lift.value = targets.lift;
      progress.value = targets.progress;
      onAim?.({ snap: true, card, landInPlace: true });
      presence.value = first || reducedMotion ? 1 : withSpring(1, MORPH_SPRING);
      return;
    }
    // Content flow first (same frame either way), then the box springs.
    // The caller's targets only ever change with the shown value — a
    // crossing re-aims them exactly once, on the empty beat.
    const landInPlace = prevPose !== 'card' || prevKey !== shownKey;
    onAim?.({ snap: false, card, landInPlace });
    // A live in-card move (the token changing between two defined
    // values while the card stays put) runs the height on the
    // arrangement clock; everything else rides the box springs.
    const heightRidesArrange =
      card &&
      prevPose === 'card' &&
      prevToken !== undefined &&
      heightArrangeToken !== undefined &&
      prevToken !== heightArrangeToken;
    presence.value = withSpring(1, MORPH_SPRING);
    width.value = withSpring(targets.width, MORPH_SPRING);
    // A crossing lands content and height target together — in one
    // piece — see `cardContentMeasured` for the one deferral.
    const landed = card && prevPose === 'card' && prevKey !== shownKey;
    if (!landed || cardContentMeasured) {
      height.value = heightRidesArrange
        ? withTiming(targets.height, {
            duration: ARRANGE_MS,
            easing: arrangeEase,
          })
        : withSpring(targets.height, MORPH_SPRING);
    }
    radius.value = withSpring(targets.radius, MORPH_SPRING);
    lift.value = withSpring(targets.lift, MORPH_SPRING);
    progress.value = withSpring(targets.progress, MORPH_SPRING);
  }, [
    cardContentMeasured,
    cardHeight,
    cardRadius,
    cardWidth,
    height,
    heightArrangeToken,
    lift,
    onAim,
    pillSize,
    pose,
    presence,
    progress,
    radius,
    reducedMotion,
    shownKey,
    width,
  ]);

  // Size and position ride separate styles on purpose: the size worklet
  // returns layout props only (no transform array), so its output passes
  // reanimated's shallow-equal check and re-commits layout ONLY when the
  // morph moves those axes — while presence and keyboard frames stay
  // pure view transforms, no Yoga pass. The translate restates the old
  // bottom-margin ride exactly: the layer bottom-anchors this single
  // child, so margin and -translate are the same pixel.
  const geometrySizeStyle = useAnimatedStyle(
    () => ({
      width: width.value,
      height: height.value,
      borderRadius: radius.value,
    }),
    [height, radius, width],
  );
  const positionStyle = useAnimatedStyle(
    () => ({
      // Being-there, the sheet's own door: exits sink the whole shell
      // below the bottom edge, entrances rise from there — opaque all
      // the way, like a presented sheet. The lift and the keyboard's own
      // spring ride the same axis, so app-side inputs stay above it
      // frame for frame.
      transform: [
        {
          translateY:
            (1 - presence.value) *
              (height.value + lift.value + EXIT_OVERSHOOT) -
            lift.value -
            keyboard.height.value,
        },
      ],
    }),
    [height, keyboard, lift, presence],
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
  // The pose window times the crossing swap: swapFade is the two-phase
  // branch fade, 1 whenever no crossing is in flight. Opacity and scale
  // only — the static centering block lives in the memoized plain style
  // below, out of the per-frame worklet.
  const cardFadeStyle = useAnimatedStyle(
    () => ({
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
    [progress, swapFade],
  );

  const shellStyle = useMemo(
    () => [styles.shell, geometrySizeStyle, positionStyle],
    [geometrySizeStyle, positionStyle],
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
    () => [
      styles.cardContent,
      { width: cardWidth, marginLeft: -cardWidth / 2 },
      cardFadeStyle,
    ],
    [cardFadeStyle, cardWidth],
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
              {stageLayer}
              {/* Always mounted: this wrapper carries the pose window
                  and the crossing swapFade — the branch fade — over the
                  parked seats inside. A crossing only flips which seat
                  is lit, on the empty beat, and builds nothing. No
                  mount fades anywhere here — the wrapper owns every
                  fade, and seats never leave. */}
              <Animated.View style={cardStyle}>
                {seats.map((seat) => (
                  <PanelSeat key={seat.key} active={seat.active}>
                    {seat.node}
                  </PanelSeat>
                ))}
              </Animated.View>
              <Animated.View style={pillStyle} pointerEvents="none">
                {/* Keyed by its words: a key change swaps the row in
                    place with a fade — the capsule itself never moves.
                    The hugging wrapper measures the row for the
                    capsule's own rest size. */}
                <Animated.View
                  key={capsuleKey}
                  entering={FadeIn.duration(CAPSULE_SWAP_IN_MS).delay(
                    CAPSULE_SWAP_IN_DELAY_MS,
                  )}
                  exiting={FadeOut.duration(CAPSULE_SWAP_OUT_MS)}
                >
                  <View onLayout={onPillLayout}>{capsule}</View>
                </Animated.View>
              </Animated.View>
            </Theme>
          </Animated.View>
        </Animated.View>
      </Stack>
    </Portal.Body>
  );
}
