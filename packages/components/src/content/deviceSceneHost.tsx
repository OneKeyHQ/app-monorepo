import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';

import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import {
  CONTENT_IN_MS,
  GLASS_SWEEP_TRACK,
  SCREEN_SWAP_OUT_MS,
  contentInEase,
  easeInFn,
  trackAt,
  useSceneClock,
} from './deviceScene';
import { LinearGradient } from './LinearGradient';

import type { IKeyframe } from './deviceScene';
import type { ViewStyle } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

/**
 * Shared scene-hosting machinery of the presence-model devices
 * (ClassicDevice, ProDevice, Pro2Device): the registry contract a
 * device's scenes fill in, the
 * screen-presence engine that runs entrances, exits and the clock, and the
 * two light components every scene choreography is built from. The
 * schedules these evaluate live in ./deviceScene; a device contributes
 * nothing but screen content and its registry.
 */

/** What a scene's content component receives. */
export interface IDeviceSceneContentProps {
  /** Scene clock for looping choreography, held at 0 through the entry. */
  clock: SharedValue<number>;
  /** Report the pixels on the glass; only `defersEntry` scenes need to. */
  onReady: () => void;
}

export interface IDeviceSceneSpec {
  /**
   * Screen content on the device's screen canvas, or null for a scene the
   * physical device spends with a dark screen: the glass just stays
   * dark, and a swap treats the scene as having nothing to fade.
   */
  content: ComponentType<IDeviceSceneContentProps> | null;
  /**
   * The content's pixels land later than its layout (an image is decoded
   * asynchronously, well after the layout event), so the entrance must
   * additionally wait for the content's own `onReady` — otherwise the
   * ramp plays over an empty view and the picture lands already bright.
   */
  defersEntry?: true;
  /** Looping choreography, evaluated on the scene clock after the entry. */
  loop?: { loopMs: number; restMs: number };
}

/** The presence engine's animation contract: one screen-content opacity. */
export interface IDeviceScreenAnimation {
  screenContent: Readonly<SharedValue<number>>;
}

/** The traveling light's peak brightness, shared by every sheen layer. */
export const SHEEN_COLOR = 'rgba(255,255,255,0.22)';

const styles = StyleSheet.create({
  slot: {
    flex: 1,
  },
  // Troupe seats stack every resident scene over the same glass; each
  // seat's own opacity plays the handover.
  troupeSeat: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

/** Troupe scenes skip the entry gate — the seat owns their reveal. */
function noopReady() {}

/**
 * One troupe seat: a resident scene's place on the glass, its opacity
 * playing the single-scene screen's handover grammar without ever
 * building anything. Deactivation fades the scene off the glass;
 * activation waits out that fade, then wakes the scene from black on
 * the content-in ramp — by which time its clock (restarted from 0 by
 * the paused flip) is exactly at the choreography's light-start. An
 * activation granted `instantEntry` lands already lit instead: its
 * presenter's own fade carries the entrance, and a wake ramp under
 * that fade would play as dead black. A reactivation caught mid-fade
 * skips the wait and ramps up from wherever the fade stopped.
 */
function TroupeSeat({
  active,
  instantEntry,
  children,
}: {
  active: boolean;
  instantEntry?: boolean;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  // Read at the activation moment, never re-triggering it: the grant is
  // per arrival, and later renders may retire it while the seat holds.
  const instantRef = useRef(instantEntry);
  instantRef.current = instantEntry;
  const shown = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    cancelAnimation(shown);
    if (reducedMotion) {
      shown.value = active ? 1 : 0;
      return;
    }
    if (!active) {
      shown.value = withTiming(0, {
        duration: SCREEN_SWAP_OUT_MS,
        easing: easeInFn,
      });
      return;
    }
    if (instantRef.current) {
      shown.value = 1;
      return;
    }
    const foldBack = shown.value > 0.02;
    const wake = withTiming(1, {
      duration: CONTENT_IN_MS,
      easing: contentInEase,
    });
    shown.value = foldBack ? wake : withDelay(SCREEN_SWAP_OUT_MS, wake);
  }, [active, reducedMotion, shown]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: shown.value }), [shown]);
  const style = useMemo(() => [styles.troupeSeat, fadeStyle], [fadeStyle]);
  return (
    <Animated.View style={style} pointerEvents="none">
      {children}
    </Animated.View>
  );
}

/**
 * A layer following keyframe tracks of the scene clock: `track` drives
 * opacity, `shiftTrack` a horizontal slide; either may be omitted for a
 * layer that only does the other (the Classic's caret pair slides at
 * full opacity). Every animated part of the entry screens — a key's
 * slice of the traveling sheen, an entered mark riding its cluster, a
 * glyph cross-fading in its slot (the layer carries children then) — is
 * exactly that.
 */
export function TrackedLayer({
  clock,
  track,
  shiftTrack,
  baseStyle,
  children,
}: {
  clock: SharedValue<number>;
  track?: IKeyframe[];
  shiftTrack?: IKeyframe[];
  baseStyle: ViewStyle;
  children?: ReactNode;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    if (!track) {
      return {
        transform: [
          { translateX: shiftTrack ? trackAt(clock.value, shiftTrack) : 0 },
        ],
      };
    }
    const opacity = trackAt(clock.value, track);
    if (!shiftTrack) {
      return { opacity };
    }
    return {
      opacity,
      transform: [{ translateX: trackAt(clock.value, shiftTrack) }],
    };
  }, [clock, track, shiftTrack]);
  const style = useMemo(
    () => [baseStyle, animatedStyle],
    [animatedStyle, baseStyle],
  );
  return (
    <Animated.View pointerEvents="none" style={style}>
      {children}
    </Animated.View>
  );
}

// The gradient wrapper runs style through Tamagui's usePropsAndStyle, which
// expects a plain object (same note as the Classic shell).
const SWEEP_GRADIENT_FILL = { flex: 1 };
// Gradient axis pinned corner to corner; white-transparent ends so nothing
// darkens through the fade. The center tenth of the 3x carrier is the same
// ~30% of the region diagonal the band always spanned.
const SWEEP_START = { x: 0, y: 0 } as const;
const SWEEP_END = { x: 1, y: 1 } as const;
const SWEEP_COLORS = [
  'rgba(255,255,255,0)',
  SHEEN_COLOR,
  'rgba(255,255,255,0)',
];
const SWEEP_LOCATIONS = [0.45, 0.5, 0.55] as const;
/** Carrier shift each way, in region sizes: parks the band past a corner. */
const SWEEP_TRAVEL_FACTOR = 0.75;

/**
 * The traveling glass light over a `width` x `height` region, inside
 * `clipStyle` (a box positioned by the caller): a region-sized band
 * translated along the diagonal. The band's carrier is the region scaled
 * 3x and centered, so the gradient axis stays parallel to the region's
 * diagonal while the carrier's edges — where a diagonal band tapers
 * toward the rectangle's corners — never enter it mid-crossing.
 *
 * The gradient is painted at 1x region size and scaled up onto the
 * carrier: expo-linear-gradient rasterizes its full bounds into a
 * CPU-drawn bitmap on iOS (a main-thread CGContext draw at screen
 * scale), so painting the carrier directly costs nine region areas of
 * raster right at scene mount — main-thread time the entry ramp is
 * running on. The paint box keeps the carrier's aspect ratio, so the
 * axis and locations are unchanged, and a smooth ramp magnifies
 * losslessly. Confirm plays the sweep across the whole screen;
 * enterPassphrase over the keyboard (the Pro 2 clips it to its panel
 * box, the Pro paints its gap grille back over it).
 */
export function GlassSweep({
  clock,
  width,
  height,
  clipStyle,
}: {
  clock: SharedValue<number>;
  width: number;
  height: number;
  clipStyle: ViewStyle;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const shift =
      (trackAt(clock.value, GLASS_SWEEP_TRACK) * 2 - 1) * SWEEP_TRAVEL_FACTOR;
    return {
      transform: [
        { translateX: shift * width },
        { translateY: shift * height },
      ],
    };
  }, [clock, height, width]);
  const style = useMemo(
    () => [
      {
        position: 'absolute' as const,
        left: -width,
        top: -height,
        width: width * 3,
        height: height * 3,
      },
      animatedStyle,
    ],
    [animatedStyle, height, width],
  );
  const paintStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: width,
      top: height,
      width,
      height,
      transform: [{ scale: 3 }],
    }),
    [height, width],
  );
  return (
    <View pointerEvents="none" style={clipStyle}>
      <Animated.View style={style}>
        <View style={paintStyle}>
          <LinearGradient
            colors={SWEEP_COLORS}
            locations={SWEEP_LOCATIONS}
            start={SWEEP_START}
            end={SWEEP_END}
            style={SWEEP_GRADIENT_FILL}
          />
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * Hosts a scene on the screen canvas: builds its clock from the registry
 * spec (no loop means the clock just rests at 0) and renders its content.
 */
function SceneHostBase<TScene extends string>({
  scene,
  scenes,
  paused,
  onReady,
}: {
  scene: TScene;
  scenes: Record<TScene, IDeviceSceneSpec>;
  paused?: boolean;
  onReady: () => void;
}) {
  const spec = scenes[scene];
  const clock = useSceneClock(
    spec.loop?.loopMs ?? 0,
    spec.loop?.restMs ?? 0,
    CONTENT_IN_MS,
    paused,
  );
  const Content = spec.content;
  if (!Content) return null;
  return <Content clock={clock} onReady={onReady} />;
}
// Memoized: the troupe slot below rebuilds on every crossing, pause flip,
// grant and warm-up beat, and without this bail every PARKED scene
// re-renders its whole content tree (dozens of SVG/Tamagui nodes) for
// zero native change. Per-seat props are stable while a seat holds, so
// only the seats whose `paused` actually flips re-render. The cast keeps
// the generic signature memo() erases.
const SceneHost = memo(SceneHostBase) as typeof SceneHostBase;

/**
 * The troupe screen: every resident scene stays built on the glass,
 * stacked, and `target` names the one on show. A scene change never
 * builds — the crossing plays the single-scene screen's own handover on
 * opacity alone (the outgoing scene fades off the glass, the incoming
 * one wakes from black on the content-in ramp, its clock running from 0
 * so the choreography lands as the wake completes; see TroupeSeat).
 * `instantEntry` is consulted at each arrival, for presenters whose own
 * fade carries the entrance. The returned contract holds the shell's
 * screen-content opacity at 1 — the seats own the show. `slot` is
 * undefined until the troupe has a member; a `target` outside the
 * troupe (or undefined) fades to dark glass.
 */
export function useSceneTroupe<TScene extends string>(
  target: TScene | undefined,
  resident: readonly TScene[] | undefined,
  scenes: Record<TScene, IDeviceSceneSpec>,
  instantEntry?: boolean,
  paused?: boolean,
): { slot: ReactNode | undefined; animation: IDeviceScreenAnimation } {
  const lit = useSharedValue(1);
  const animation: IDeviceScreenAnimation = useMemo(
    () => ({ screenContent: lit }),
    [lit],
  );
  const slot = useMemo(() => {
    if (!resident?.length) return undefined;
    return (
      <View style={styles.slot} pointerEvents="none">
        {resident.map((name) => (
          <TroupeSeat
            key={name}
            active={name === target}
            instantEntry={instantEntry}
          >
            <SceneHost
              scene={name}
              scenes={scenes}
              paused={paused || name !== target}
              onReady={noopReady}
            />
          </TroupeSeat>
        ))}
      </View>
    );
  }, [instantEntry, paused, resident, scenes, target]);
  return useMemo(() => ({ slot, animation }), [animation, slot]);
}

/**
 * The screen-presence engine: given the scene a device is asked to show
 * and its registry, it owns what is actually on the glass — the swap away
 * from lit content, the entry gate, and the one screen-content opacity the
 * shell renders through. Returns the keyed slot to hand the shell and the
 * animation contract driving it; `displayed` undefined means the screen is
 * dark (no scene, or a scene whose content is null).
 *
 * `instantEntry` lands an entry already lit — honored at the moment the
 * entry gate fires, for presenters that carry the entrance themselves: a
 * stage fading the whole replica in would only stack the ramp under its
 * fade as dead black time. The presenter grants it per arrival; entries
 * with it unset keep the ramp.
 *
 * `paused` stands the scene's clock down at its opening still, for
 * instances a presenter keeps mounted but hidden; clearing it starts the
 * loop schedule from 0 (see useSceneClock).
 */
export function useSceneScreen<TScene extends string>(
  target: TScene | undefined,
  scenes: Record<TScene, IDeviceSceneSpec>,
  instantEntry?: boolean,
  paused?: boolean,
): {
  displayed: TScene | undefined;
  slot: ReactNode | undefined;
  animation: IDeviceScreenAnimation;
} {
  // The scene actually on the glass. A scene with lit content leaves
  // through its content-out before the target takes over; a scene with no
  // content has nothing to fade and hands over at once.
  const [displayed, setDisplayed] = useState(target);
  const reducedMotion = useReducedMotion();
  // The one screen-content opacity every scene renders through. Resident:
  // it outlives scene mounts and is scheduled here, decoupled from mount
  // timing, so a busy mount frame cannot swallow an entrance and pop the
  // content in fully shown.
  const screenIn = useSharedValue(0);
  useEffect(() => {
    if (target === displayed) return undefined;
    if (displayed && scenes[displayed].content && !reducedMotion) {
      cancelAnimation(screenIn);
      // The swap fires from the fade's own completion, never a parallel
      // timer. A timer races the UI-thread animation, which starts a
      // dispatch or two later, so it fires while the ease-in fade still
      // holds its last 10-30% of opacity — the incoming scene's entry
      // then ramps up from that leftover floor instead of from black.
      // The dim keyboard stills hid the floor; confirm's bright blocks
      // showed it (and the lighter the scene, the sooner the mount cut
      // the fade short, the higher the floor).
      screenIn.value = withTiming(
        0,
        { duration: SCREEN_SWAP_OUT_MS, easing: easeInFn },
        (finished) => {
          'worklet';
          if (finished) runOnJS(setDisplayed)(target);
        },
      );
      // Covers the fold-back (target returns to `displayed` mid-exit):
      // kill the flying fade so its callback cannot land a stale swap;
      // the arm effect below then ramps the entry back up from wherever
      // the fade stopped.
      return () => cancelAnimation(screenIn);
    }
    screenIn.value = 0;
    setDisplayed(target);
    return undefined;
  }, [displayed, reducedMotion, scenes, screenIn, target]);
  // Entry gate. The ramp starts only once the scene is genuinely on the
  // glass — otherwise its clock runs through the mount and can be most of
  // the way done before the first visible frame, which reads as content
  // appearing fully shown. Two signals say "on the glass": the scene has
  // been laid out, and, for a `defersEntry` scene (whose pixels arrive
  // later than its layout), that it has loaded. Both are per mount and
  // either can land first — including before the effect that arms the
  // gate — so every one of them just reports in, and whichever completes
  // the set starts the ramp.
  const gateRef = useRef({
    scene: displayed,
    laidOut: false,
    pixels: false,
    armed: false,
  });
  if (gateRef.current.scene !== displayed) {
    gateRef.current = {
      scene: displayed,
      laidOut: false,
      pixels: false,
      armed: false,
    };
  }
  const tryEnter = useCallback(() => {
    const gate = gateRef.current;
    if (!gate.armed || !gate.laidOut) return;
    const spec = gate.scene ? scenes[gate.scene] : undefined;
    if (spec?.defersEntry && !gate.pixels) return;
    gate.armed = false;
    cancelAnimation(screenIn);
    if (instantEntry) {
      screenIn.value = 1;
      return;
    }
    screenIn.value = withTiming(1, {
      duration: CONTENT_IN_MS,
      easing: contentInEase,
    });
  }, [instantEntry, scenes, screenIn]);
  useEffect(() => {
    if (!displayed || displayed !== target) return;
    if (reducedMotion) {
      gateRef.current.armed = false;
      cancelAnimation(screenIn);
      screenIn.value = 1;
      return;
    }
    gateRef.current.armed = true;
    // Arming last is the ordinary case on a swap that folded back
    // mid-exit, where the scene never remounted and both signals are
    // already in.
    tryEnter();
  }, [displayed, reducedMotion, screenIn, target, tryEnter]);
  const handleSceneLayout = useCallback(() => {
    gateRef.current.laidOut = true;
    tryEnter();
  }, [tryEnter]);
  const handleSceneReady = useCallback(() => {
    gateRef.current.pixels = true;
    tryEnter();
  }, [tryEnter]);
  // The screen slot. Keyed so each scene reports its own layout to the
  // gate above, memoized so the shell's memoized body only reconciles on a
  // real change.
  const slot = useMemo(() => {
    if (!displayed || !scenes[displayed].content) return undefined;
    return (
      <View key={displayed} style={styles.slot} onLayout={handleSceneLayout}>
        <SceneHost
          scene={displayed}
          scenes={scenes}
          paused={paused}
          onReady={handleSceneReady}
        />
      </View>
    );
  }, [displayed, handleSceneLayout, handleSceneReady, paused, scenes]);
  const animation: IDeviceScreenAnimation = useMemo(
    () => ({ screenContent: screenIn }),
    [screenIn],
  );
  return useMemo(
    () => ({ displayed, slot, animation }),
    [animation, displayed, slot],
  );
}
