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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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

import {
  TamaguiTheme as Theme,
  useThemeName,
} from '@onekeyhq/components/src/shared/tamagui';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getDisplayCornerRadius } from '@onekeyhq/shared/src/utils/displayCornerUtils';

import { IconButton } from '../../actions/IconButton';
import { easeInFn, easeOutFn } from '../../content/deviceScene';
import { Portal } from '../../hocs';
import { useMedia } from '../../hooks/useStyle';
import { Stack } from '../../primitives';

import type { LayoutChangeEvent } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

/**
 * The morphing overlay: one dark container floating over the app,
 * resting as a capsule when nothing is asked of the person and blooming
 * into a card when something is — the breathing is the point. It owns
 * the surface itself: the pose springs, the measured rest sizes, the
 * presence door, the keyboard ride, the two-phase crossing that swaps
 * one card content for another on an empty beat, and the chrome around
 * the content — the optional scrim, the card's toolbar band (grabber
 * and close button), the capsule's trailing close button, and the
 * dismiss gestures. What the poses SAY is the caller's business
 * entirely — content arrives as slots (capsule row, parked card seats,
 * an optional under-content stage layer), and callers with animated
 * flow of their own ride the same clock through `onAim` (see
 * DeviceStage, the container's one tenant and the reason it exists).
 *
 * The design file's layer tree maps onto the view like this (Modules /
 * MorphOverlay): Overlay → the scrim; Outer Container → the layer plus
 * the lift; Card → the shell and its clipping face; Toolbar → the
 * toolbar band over the seats (card pose only); Content Container → the
 * seats' column (card) or the caller's capsule row inside the capsule's
 * own padding; CloseButton → absolute in the toolbar (card), trailing
 * in the row (capsule).
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
 * The views themselves render through the portal, which commits one
 * React pass behind those effects — so everything that must land on
 * the reveal's first frame is a shared value (geometry, fades, the lit
 * seat), never a React style.
 *
 * Still out of scope until ratified: accessibility focus and the
 * Android back button. Judge springs in a release build — dev-mode JS
 * load slanders the engine.
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
export const STAGE_BG = '#060606';
export function stageBgAlpha(alpha: number): string {
  return `rgba(6,6,6,${alpha})`;
}

/* ----------------------------- tuning knobs ----------------------------- */

/**
 * The resting capsule's own chrome: `pad` is the capsule's padding
 * around the caller's row (the trailing close button sits inside it),
 * `lift` its clearance from the layer's bottom edge (the spec floats it
 * clear). The caller's row is the capsule's content — whatever it
 * renders, plus this padding, IS the capsule, radius pinned to
 * height/2, a true capsule.
 */
export const PILL = {
  pad: 16,
  lift: 36,
};

/** First-frame stand-ins for the capsule's rest size, corrected by the
 * row's first layout report. */
const PILL_REST = {
  estimatedWidth: 195,
  estimatedHeight: 76,
};

/**
 * The expanded card, floating the way the system sheet itself floats
 * (the iOS 26 appearance: ~10-13pt of air on the sides and the bottom,
 * measured off the sheet on an iPhone 17 Pro): `margin` is that gap,
 * and the corner radius is concentric with the display (display corner
 * radius minus `margin`) wherever the device publishes one; `radius`
 * is the fallback for everywhere else — the concentric value on the
 * reference phone. Height hugs the content column plus the chrome.
 * `pad` is the content column's side inset; `padTop` is the toolbar
 * band the content starts under (the grabber's 16 plus 10 of air) — a
 * fixed band, so the close button coming and going never shifts the
 * column; `bottomPad` is the air under the last block, which together
 * with `margin` clears a home-indicator phone's 34pt zone.
 */
export const CARD = {
  margin: 8,
  radius: 48,
  pad: 24,
  padTop: 26,
  bottomPad: 28,
  /** The wide-posture cap — the desktop dialog's own content width (see
   * Dialog's MAX_CONTENT_WIDTH). Phone-posture windows never cap: the
   * card tracks the screen edges the way the system sheet itself does,
   * whatever the phone's width. */
  maxWidth: 400,
};

/** The toolbar's furniture: the system sheet's own grabber, and the
 * 44pt close circle inset from the card's top-right corner. */
const GRABBER = { top: 5, width: 36, height: 5 };
const CLOSE = { inset: 16, size: 44 };

/** The optional scrim over the app — the design's dark overlay, lighter
 * on the light theme. */
const SCRIM_ALPHA = { light: 0.2, dark: 0.48 };

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

/**
 * The dismiss drag, tuned toward the system sheet: the card follows the
 * finger down 1:1 and meets a rubber band upward; release projects the
 * finger's momentum a beat ahead and dismisses past half the card,
 * otherwise the card springs back to rest. The drag rides `presence`
 * itself — the shell's own exit axis — so a dismissing release simply
 * continues into the exit, velocity and all.
 */
const DRAG_RUBBER = 0.55;
const DRAG_PROJECTION_S = 0.15;
const DRAG_DISMISS_FRACTION = 0.5;
const DRAG_ACTIVATION_PT = 10;

/** The iOS rubber band: a pull of `distance` against a box of
 * `dimension` yields ever less travel, never exceeding the box. */
function rubberBand(distance: number, dimension: number): number {
  'worklet';

  return (1 - 1 / ((distance * DRAG_RUBBER) / dimension + 1)) * dimension;
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
  // The wide posture's anchor: the shell hangs from the top edge.
  layerTop: {
    justifyContent: 'flex-start',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  // Anchored to the face's top-left, where the capsule's content also
  // rests while the box grows: the row and the caller's thumbnail seat
  // (pinned off the same left edge) stay together through the fade. A
  // row, so the close button trails the measured row in flow.
  pillContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillRow: {
    padding: PILL.pad,
  },
  // Tucked into the row's own trailing padding: the design seats the
  // button right after the content, inside the capsule's padding.
  pillClose: {
    marginLeft: -PILL.pad,
    marginRight: PILL.pad,
  },
  // Anchored to the container's horizontal center at its final width, so
  // the growing face reveals it center-out, symmetric like the reference.
  cardContent: {
    position: 'absolute',
    top: 0,
    left: '50%',
  },
  // The toolbar band over the seats, on the same centering: the grabber
  // at the card's center, the close button inset from its corner. Tall
  // enough to contain the button (native hit-testing stops at a parent's
  // frame); box-none, so the band itself never takes a touch from the
  // column under it.
  toolbar: {
    position: 'absolute',
    top: 0,
    left: '50%',
    height: CLOSE.inset + CLOSE.size,
    alignItems: 'center',
  },
  grabber: {
    marginTop: GRABBER.top,
    width: GRABBER.width,
    height: GRABBER.height,
    borderRadius: GRABBER.height / 2,
  },
  cardBadge: {
    position: 'absolute',
    top: CLOSE.inset,
    left: CLOSE.inset,
    height: CLOSE.size,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  cardClose: {
    position: 'absolute',
    top: CLOSE.inset,
    right: CLOSE.inset,
  },
  // Every seat spans the card's width at its top and carries the card's
  // own content inset, so seat columns start below the toolbar band and
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
});

/**
 * One parked panel's seat in the card. Which seat is lit is a shared
 * value (`litKey`) the container flips in its own layout effect — the
 * same JS turn that aims the reveal, so the flip and the reveal reach
 * the UI thread on one frame. Not a React style flip on purpose: the
 * overlay's views render through a portal, one React commit behind the
 * effects that drive them, and a style flip would land after the reveal
 * had begun — the outgoing seat lighting up for the reveal's first
 * frames, then vanishing. Every live fade belongs to the wrapper above
 * (swapFade and the pose window), never to the seat, so nothing can
 * relight over a reveal. Touch follows the caller's `active` flag; a
 * commit's lag there is harmless.
 */
function PanelSeat({
  seatKey,
  litKey,
  active,
  children,
}: {
  seatKey: string;
  litKey: SharedValue<string | undefined>;
  active: boolean;
  children: ReactNode;
}) {
  const litStyle = useAnimatedStyle(
    () => ({ opacity: litKey.value === seatKey ? 1 : 0 }),
    [litKey, seatKey],
  );
  const style = useMemo(() => [styles.panelSeat, litStyle], [litStyle]);
  // `pointerEvents="none"` alone cannot silence a parked seat on web: RNW
  // inputs specify their own `pointer-events: auto`, which re-enables
  // hit-testing under a `none` ancestor — an invisible parked input could
  // still swallow clicks, steal focus, and stay reachable via Tab. `inert`
  // (a web-only prop RNW forwards) blankets the whole subtree so no
  // descendant can opt back in; `aria-hidden` hides parked seats from
  // assistive tech on both platforms.
  return (
    <Animated.View
      style={style}
      aria-hidden={!active}
      {...(platformEnv.isNative ? null : { inert: !active })}
      pointerEvents={active ? 'box-none' : 'none'}
    >
      {children}
    </Animated.View>
  );
}

/** The close control, one look in both poses: the design's 44pt
 * neutral circle around the large cross. */
function CloseButton({
  onPress,
  testID,
}: {
  onPress: () => void;
  testID: string;
}) {
  return (
    <IconButton
      testID={testID}
      icon="CrossedLargeOutline"
      variant="secondary"
      size="medium"
      w={CLOSE.size}
      h={CLOSE.size}
      bg="$neutral5"
      alignItems="center"
      justifyContent="center"
      onPress={onPress}
    />
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
  /** The capsule's measured rest size — the caller's row plus the
   * capsule's own padding (estimates until the first layout report). */
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
  // on the in beat. Pose flips bypass the machine in BOTH directions:
  // the pose windows carry those changes, and the effect below lands
  // them silently (see the held.pose branch) — a key change only runs
  // the two-phase swap between two card arrangements.
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
    if (held.pose !== 'card') {
      // A pose flip INTO the card (capsule or hidden -> card): not a
      // crossing — `shown` already follows the live value and the pose
      // window alone carries the arrival. Land silently with the fade
      // at rest; running the two-phase swap here would multiply a dip
      // into the window's own fade-in (a visible dark-bright-dark
      // flicker) and spend a mid-flight land commit for nothing.
      cancelAnimation(swapFade);
      swapFade.value = 1;
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

  // Both rest poses hug their content: the capsule row (the caller's
  // content inside the capsule's own padding, so its box IS the capsule)
  // and the active card column each report their natural size and the
  // springs re-aim to the measured rests. The estimates only cover the
  // first frames of a fresh pose.
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
  // `presence` is the whole shell's being-there, the hidden pose's axis
  // — and the dismiss drag's.
  // Rest values are estimates; the view's first layout effect lands the
  // real pose targets before anything paints.
  const width = useSharedValue(PILL_REST.estimatedWidth);
  const height = useSharedValue(PILL_REST.estimatedHeight);
  const radius = useSharedValue(PILL_REST.estimatedHeight / 2);
  const lift = useSharedValue(PILL.lift);
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
   * chrome excluded; the container adds its toolbar band and its chin. */
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
  /**
   * The person's way out, and the switch for every dismissal at once:
   * given, the card wears its close button and follows a downward drag
   * (release past half the card, or with momentum, dismisses), and the
   * capsule wears its trailing close button; absent, none of those
   * exist and the stage can only be left by the driver. Tapping outside
   * never dismisses — a stray tap must not cancel a device operation.
   * When to grant it is the driver's policy (the hardware flows arm it
   * on a timer). A dismissing drag has already started the exit when
   * this fires — the driver must answer by moving the content to the
   * hidden pose.
   */
  onDismiss?: () => void;
  /**
   * Whether the app behind is blocked while the shell is there. On, an
   * invisible wall takes every touch outside the shell — the person
   * stays with the overlay until it leaves; the wall itself never
   * dismisses (the system sheet's own rule — only the drag and the
   * close button do). Off, the app behind stays live — the system
   * sheet's undimmed, non-modal mode.
   */
  modal?: boolean;
  /**
   * The dark scrim over the blocked app (implies `modal`), fading with
   * the shell's presence. The design's overlay layer — optional, and
   * off for the hardware flows, which block without dimming.
   */
  scrim?: boolean;
  /**
   * Fires when the pose geometry comes to rest — on the springs' own
   * completion after a pose move, and immediately when a change lands
   * without motion (a snap, an entrance, reduced motion, the hidden
   * pose). May fire more than once per flight (effect re-runs re-aim
   * the springs); treat it as level, not edge. Content uses it to end
   * flight-scoped economies (DeviceStage rasterizes the replica while
   * the box is moving — see there).
   */
  onGeometrySettled?: () => void;
  /** Keyed capsule row: a key change swaps the row in place with a fade
   * — the capsule itself never moves. */
  capsuleKey: string;
  capsule: ReactNode;
  /** The card's other corner seat: a small badge absolute at the top
   * left, the close button's mirror (the stage names the device there).
   * Rides the toolbar band, so it fades with the card window. Null
   * renders nothing. */
  cornerBadge?: ReactNode;
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
  onDismiss,
  onGeometrySettled,
  modal = false,
  scrim = false,
  capsuleKey,
  capsule,
  cornerBadge,
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
  const keyboard = useAnimatedKeyboard();
  const themeName = useThemeName();
  const media = useMedia();
  // The posture switch, on the Dialog's own sheet↔panel line (md, a
  // phone-class window): phone posture rests the shell on the bottom
  // edge — the sheet grammar, thumb and keyboard territory — while a
  // wide window (iPad, desktop, a wide web tab) hangs it from the top,
  // where the notification grammar lives. One boundary, two faces: the
  // anchor flips, and the card's width cap applies only to the wide
  // side.
  const phonePosture = media.md;
  const cardWidth = phonePosture
    ? screenWidth - CARD.margin * 2
    : Math.min(screenWidth - CARD.margin * 2, CARD.maxWidth);
  const cardHeight = CARD.padTop + cardInnerHeight + CARD.bottomPad;
  const dismissible = Boolean(onDismiss);
  const blocking = modal || scrim;
  // The capsule's close button rides outside the measured row, so the
  // box simply widens by the button when the grant arrives — no
  // re-measure, and the row's words never rebuild for it.
  const pillWidth = pillSize.width + (dismissible ? CLOSE.size : 0);
  // A launch-time device constant; memoized only to skip the Settings
  // read on re-renders.
  const cardRadius = useMemo(() => {
    const screenCornerRadius = getDisplayCornerRadius();
    return screenCornerRadius ? screenCornerRadius - CARD.margin : CARD.radius;
  }, []);

  // The lit seat, as a shared value — see PanelSeat for why.
  const activeSeatKey = seats.find((seat) => seat.active)?.key;
  const litKey = useSharedValue<string | undefined>(activeSeatKey);

  const prevPoseRef = useRef(pose);
  const prevKeyRef = useRef(shownKey);
  const prevTokenRef = useRef(heightArrangeToken);
  const firstRunRef = useRef(true);
  // Layout effect on purpose: the springs are aimed before this commit
  // paints, so the first morph frame ships with the driver's own
  // re-render instead of one frame behind it — and the mount lands its
  // pose targets before the estimates ever paint.
  useLayoutEffect(() => {
    // First, before anything can reveal: the seat flip rides the same
    // turn as every aim below, and as the reveal the hook issues after.
    litKey.value = activeSeatKey;
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
      // the slide never doubles as a shrink. After a dismissing drag
      // the exit is already in flight on this very axis — the spring
      // re-aimed here simply carries on, velocity and all.
      presence.value = first || reducedMotion ? 0 : withSpring(0, MORPH_SPRING);
      onGeometrySettled?.();
      return;
    }
    const card = pose === 'card';
    const targets = {
      width: card ? cardWidth : pillWidth,
      height: card ? cardHeight : pillSize.height,
      // A capsule's radius tracks its own height — always half of it.
      radius: card ? cardRadius : pillSize.height / 2,
      lift: card ? CARD.margin : PILL.lift,
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
      onGeometrySettled?.();
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
    progress.value = withSpring(targets.progress, MORPH_SPRING, (finished) => {
      if (finished && onGeometrySettled) {
        runOnJS(onGeometrySettled)();
      }
    });
  }, [
    onGeometrySettled,
    activeSeatKey,
    cardContentMeasured,
    cardHeight,
    cardRadius,
    cardWidth,
    height,
    heightArrangeToken,
    lift,
    litKey,
    onAim,
    pillSize,
    pillWidth,
    pose,
    presence,
    progress,
    radius,
    reducedMotion,
    shownKey,
    width,
  ]);

  // The dismiss callback rides a ref so the gesture never rebuilds for a
  // fresh closure — the driver's identity is its own business.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const dismiss = useCallback(() => {
    onDismissRef.current?.();
  }, []);
  // The drag rides presence — see DRAG_*. Armed only for a dismissible
  // card: the capsule has no drag (its close button is its one exit),
  // and an unarmed stage cannot be pulled at all.
  const dragEnabled = dismissible && pose === 'card';
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(dragEnabled)
        .activeOffsetY([-DRAG_ACTIVATION_PT, DRAG_ACTIVATION_PT])
        .onUpdate((event) => {
          // The dismissing direction is the anchored edge's own: down on
          // the bottom, up off the top. Normalized here, the rest of the
          // math never knows which way the shell hangs.
          const drag = phonePosture ? event.translationY : -event.translationY;
          const travel = height.value + lift.value + EXIT_OVERSHOOT;
          const pull = drag >= 0 ? drag : -rubberBand(-drag, height.value);
          presence.value = 1 - pull / travel;
        })
        .onEnd((event) => {
          const drag = phonePosture ? event.translationY : -event.translationY;
          const dragVelocity = phonePosture
            ? event.velocityY
            : -event.velocityY;
          const travel = height.value + lift.value + EXIT_OVERSHOOT;
          // Finger velocity, in presence units per second.
          const velocity = -dragVelocity / travel;
          const projected = drag + dragVelocity * DRAG_PROJECTION_S;
          if (projected > height.value * DRAG_DISMISS_FRACTION) {
            presence.value = withSpring(0, { ...MORPH_SPRING, velocity });
            runOnJS(dismiss)();
            return;
          }
          presence.value = withSpring(1, { ...MORPH_SPRING, velocity });
        })
        .onFinalize((_event, success) => {
          // A drag taken over by another recognizer ends nowhere: rest.
          if (!success) {
            presence.value = withSpring(1, MORPH_SPRING);
          }
        }),
    [dismiss, dragEnabled, height, lift, phonePosture, presence],
  );

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
  const positionStyle = useAnimatedStyle(() => {
    // Being-there, the shell's door, spoken off the anchored edge: on
    // the bottom (phone posture) exits sink below it — the presented
    // sheet's own move — and the lift and the keyboard's spring ride
    // the same axis, so app-side inputs stay above it frame for frame.
    // Hung from the top (wide posture) the same door opens upward, the
    // notification's move, and the keyboard never collides. A drag
    // pulls presence under 1 (and a breath over it, rubber-banded), so
    // the finger rides this same line either way.
    const travel =
      (1 - presence.value) * (height.value + lift.value + EXIT_OVERSHOOT);
    return {
      transform: [
        {
          translateY: phonePosture
            ? travel - lift.value - keyboard.height.value
            : lift.value - travel,
        },
      ],
    };
  }, [height, keyboard, lift, phonePosture, presence]);
  // The scrim's being-there is the shell's: it fades with the entrance,
  // the exit and the drag alike.
  const scrimFadeStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(presence.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    }),
    [presence],
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
  // The toolbar belongs to the card pose, not to its content: it rides
  // the pose window alone, so a crossing swapping the seats underneath
  // never blinks the grabber or the close button.
  const toolbarFadeStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(
        progress.value,
        [CARD_IN_START, 1],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    }),
    [progress],
  );

  // The wall over the app: painted and faded only as the scrim, a bare
  // transparent wall otherwise.
  const backdropStyle = useMemo(
    () =>
      scrim
        ? [
            styles.backdrop,
            {
              backgroundColor: `rgba(0,0,0,${
                themeName === 'dark' ? SCRIM_ALPHA.dark : SCRIM_ALPHA.light
              })`,
            },
            scrimFadeStyle,
          ]
        : styles.backdrop,
    [scrim, scrimFadeStyle, themeName],
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
  const cardCenter = useMemo(
    () => ({ width: cardWidth, marginLeft: -cardWidth / 2 }),
    [cardWidth],
  );
  const cardStyle = useMemo(
    () => [styles.cardContent, cardCenter, cardFadeStyle],
    [cardCenter, cardFadeStyle],
  );
  const layerStyle = useMemo(
    () => (phonePosture ? styles.layer : [styles.layer, styles.layerTop]),
    [phonePosture],
  );
  const toolbarStyle = useMemo(
    () => [styles.toolbar, cardCenter, toolbarFadeStyle],
    [cardCenter, toolbarFadeStyle],
  );

  return (
    // The main window's hardware-dialog level: the app mounts this portal
    // beside its dialog containers, the storybook shells mount it
    // canvas-wide. Deliberately NOT a FullWindowOverlay window — that sat
    // above every presentation, so the in-app browser (an ordinary
    // presentation) opened underneath the stage; at dialog level,
    // presentations cover it the way they cover the system sheet.
    <Portal.Body container={Portal.Constant.HARDWARE_UI_STATE_DIALOG}>
      <Stack style={layerStyle} pointerEvents="box-none">
        {blocking ? (
          // The wall blocks the app whenever the shell is there, and is
          // deliberately NOT a dismissal surface: a stray tap outside
          // must never cancel a device operation mid-flight — the close
          // button and the drag are the intentional exits. It stands
          // down the moment the shell starts leaving, so it never
          // outlives the exit.
          <Animated.View
            style={backdropStyle}
            pointerEvents={pose === 'hidden' ? 'none' : 'auto'}
          />
        ) : null}
        <GestureDetector gesture={pan}>
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
                    <PanelSeat
                      key={seat.key}
                      seatKey={seat.key}
                      litKey={litKey}
                      active={seat.active}
                    >
                      {seat.node}
                    </PanelSeat>
                  ))}
                </Animated.View>
                {/* The card's toolbar band: the grabber whenever the
                    card is on show, the close button with the grant.
                    Over the seats, so the button stays tappable above
                    whatever column is lit. */}
                <Animated.View
                  style={toolbarStyle}
                  pointerEvents={pose === 'card' ? 'box-none' : 'none'}
                >
                  {/* The grabber is the sheet grammar's handle — phone
                      posture only. A top-hung card dismisses by its
                      close button (and an upward drag, undecorated),
                      the way desktop prompt cards do. */}
                  {phonePosture ? (
                    <Stack style={styles.grabber} bg="$neutral6" />
                  ) : null}
                  {cornerBadge ? (
                    <Animated.View
                      style={styles.cardBadge}
                      entering={FadeIn.duration(CAPSULE_SWAP_IN_MS)}
                    >
                      {cornerBadge}
                    </Animated.View>
                  ) : null}
                  {dismissible ? (
                    <Animated.View
                      style={styles.cardClose}
                      entering={FadeIn.duration(CAPSULE_SWAP_IN_MS)}
                    >
                      <CloseButton
                        testID="morph-overlay-close"
                        onPress={dismiss}
                      />
                    </Animated.View>
                  ) : null}
                </Animated.View>
                <Animated.View
                  style={pillStyle}
                  pointerEvents={pose === 'capsule' ? 'box-none' : 'none'}
                >
                  {/* Keyed by its words: a key change swaps the row in
                      place with a fade — the capsule itself never moves.
                      The padded wrapper measures the row for the
                      capsule's own rest size. */}
                  <Animated.View
                    key={capsuleKey}
                    entering={FadeIn.duration(CAPSULE_SWAP_IN_MS).delay(
                      CAPSULE_SWAP_IN_DELAY_MS,
                    )}
                    exiting={FadeOut.duration(CAPSULE_SWAP_OUT_MS)}
                  >
                    <View style={styles.pillRow} onLayout={onPillLayout}>
                      {capsule}
                    </View>
                  </Animated.View>
                  {dismissible ? (
                    <Animated.View
                      style={styles.pillClose}
                      entering={FadeIn.duration(CAPSULE_SWAP_IN_MS)}
                    >
                      <CloseButton
                        testID="morph-overlay-capsule-close"
                        onPress={dismiss}
                      />
                    </Animated.View>
                  ) : null}
                </Animated.View>
              </Theme>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </Stack>
    </Portal.Body>
  );
}
