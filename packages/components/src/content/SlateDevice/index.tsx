import { useCallback, useEffect, useRef, useState } from 'react';

import { View } from 'react-native';
import {
  cancelAnimation,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { easeInFn } from '../deviceScene';

import {
  CONTENT_IN_MS,
  IMAGE_CONTENT_IN_MS,
  SCREEN_SWAP_OUT_MS,
  contentInEase,
} from './animation';
import { SCENES, SCENE_DEFERS_ENTRY, SCENE_LIT } from './scenes';
import { SlateDeviceShell } from './shell';

import type { ISlateDeviceAnimation } from './animation';
import type { ISlateDeviceScene } from './scenes';
import type { ISlateDeviceShellProps } from './shell';

export type { ISlateDeviceScene } from './scenes';
export type { ISlateDeviceAnimation } from './animation';
export { SCREEN_SWAP_MS } from './animation';

/**
 * Code-drawn Slate device. Reached through ../HardwareDevice, which is what
 * call sites use; this layer is where the device's own scenes and screen
 * live.
 *
 *   <SlateDevice animation="connecting" />       the idle wallpaper
 *   <SlateDevice animation="enterPin" />         the keyboard loop
 *   <SlateDevice animation="confirm" />          the light sweep
 *   <SlateDevice animation="enterPassphrase" />  no design yet: dark glass
 *   <SlateDevice />                              static shell, screen dark
 *
 * The glass stays pure black; "lighting up" is only content rendering onto
 * it, and every scene enters that way. A change away from a scene that has
 * content on the glass plays the swap: the outgoing scene stays mounted
 * while its content fades off, then the incoming scene renders in — one
 * continuous move, no waiting built in (callers sequence anything else
 * after SCREEN_SWAP_MS). `animation` also accepts a custom
 * ISlateDeviceAnimation contract (see ./animation.ts) paired with your own
 * `screenContent` on the 288x484 canvas.
 */
export interface ISlateDeviceProps extends Omit<
  ISlateDeviceShellProps,
  'animation'
> {
  /**
   * A built-in scene name, or a custom animation contract. With a scene name
   * the scene supplies the screen, so `screenContent` is ignored.
   */
  animation?: ISlateDeviceScene | ISlateDeviceAnimation;
}

export function SlateDevice({
  width,
  animation,
  screenContent,
}: ISlateDeviceProps) {
  const target = typeof animation === 'string' ? animation : undefined;
  // The scene actually on the glass. A scene with lit content leaves
  // through its content-out before the target takes over; a dark scene
  // has nothing to fade and hands over at once.
  const [displayed, setDisplayed] = useState(target);
  const reducedMotion = useReducedMotion();
  // The one screen-content opacity every scene renders through. Resident:
  // it outlives scene mounts and is scheduled here, decoupled from mount
  // timing, so a busy mount frame cannot swallow an entrance and pop the
  // content in fully shown.
  const screenIn = useSharedValue(0);
  useEffect(() => {
    if (target === displayed) return undefined;
    if (displayed && SCENE_LIT[displayed] && !reducedMotion) {
      cancelAnimation(screenIn);
      screenIn.value = withTiming(0, {
        duration: SCREEN_SWAP_OUT_MS,
        easing: easeInFn,
      });
      const id = setTimeout(() => setDisplayed(target), SCREEN_SWAP_OUT_MS);
      return () => clearTimeout(id);
    }
    screenIn.value = 0;
    setDisplayed(target);
    return undefined;
  }, [displayed, reducedMotion, screenIn, target]);
  // Entry gate. The ramp starts only once the scene is genuinely on the
  // glass — otherwise its clock runs through the mount and can be most of
  // the way done before the first visible frame, which reads as content
  // appearing fully shown. Two signals say "on the glass": the scene has
  // been laid out, and, for a scene whose pixels arrive later than its
  // layout (an image: layout is emitted at commit time, long before the
  // picture is fetched, decoded and handed to the layer), that it has
  // loaded. Both are per mount and either can land first — including
  // before the effect that arms the gate — so every one of them just
  // reports in, and whichever completes the set starts the ramp.
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
    const carriesImage = Boolean(gate.scene && SCENE_DEFERS_ENTRY[gate.scene]);
    if (carriesImage && !gate.pixels) return;
    gate.armed = false;
    cancelAnimation(screenIn);
    screenIn.value = withTiming(1, {
      duration: carriesImage ? IMAGE_CONTENT_IN_MS : CONTENT_IN_MS,
      easing: contentInEase,
    });
  }, [screenIn]);
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
  if (displayed) {
    const Scene = SCENES[displayed];
    return (
      // Keyed so each scene reports its own layout to the gate above.
      <View key={displayed} onLayout={handleSceneLayout}>
        <Scene width={width} screenIn={screenIn} onReady={handleSceneReady} />
      </View>
    );
  }
  // Anything else counts as dark: the bare shell is dark, and whether a
  // custom contract lights the glass is its caller's business.
  return (
    <SlateDeviceShell
      width={width}
      animation={typeof animation === 'string' ? undefined : animation}
      screenContent={typeof animation === 'string' ? undefined : screenContent}
    />
  );
}
