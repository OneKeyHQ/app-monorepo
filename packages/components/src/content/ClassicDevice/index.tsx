import { useMemo } from 'react';

import { useSharedValue } from 'react-native-reanimated';

import { useSceneScreen, useSceneTroupe } from '../deviceSceneHost';

import { ClassicPressContext } from './animation';
import { SCENES } from './scenes';
import { ClassicDeviceShell } from './shell';

import type { IClassicDeviceAnimation } from './animation';
import type { IClassicDeviceScene } from './scenes';
import type { IClassicDeviceShellProps } from './shell';

export type { IClassicDeviceScene } from './scenes';
export type { IClassicDeviceAnimation } from './animation';

/**
 * Code-drawn OneKey Classic device. Reached through ../HardwareDevice, which
 * is what call sites use; this layer is where the Classic's own scenes and
 * screen live.
 *
 *   <ClassicDevice animation="connecting" />       the OneKey mark
 *   <ClassicDevice animation="enterPin" />         the entry row loop
 *   <ClassicDevice animation="enterPassphrase" />
 *   <ClassicDevice animation="confirm" />          the light sweep
 *   <ClassicDevice />                              static shell, screen dark
 *
 * Scenes run on the shared presence machinery (../deviceSceneHost), the
 * same way the Pro's and the Pro 2's do: content renders in as the whole of
 * an entry, stays lit while the scene is on, and a scene change plays the
 * lit-to-lit handover. The panel's faint glow rides the same opacity, so
 * "lighting up" is nothing but content rendering in. The shell chrome (the
 * noise, the blurs, the four keys) mounts once here; a scene change only
 * swaps the screen slot's content, and scenes reach the OK key through the
 * per-instance press drive (./animation). `animation` also accepts a custom
 * IClassicDeviceAnimation contract paired with your own `screenContent` -
 * the way live content would go on the 256x128 OLED, which is the whole
 * point of drawing the device in code rather than shipping a Lottie.
 */
export interface IClassicDeviceProps extends Omit<
  IClassicDeviceShellProps,
  'animation'
> {
  /**
   * A built-in scene name, or a custom animation contract. With a scene name
   * the scene supplies the screen, so `screenContent` is ignored.
   */
  animation?: IClassicDeviceScene | IClassicDeviceAnimation;
  /**
   * The next entry arrives already lit — granted per arrival by presenters
   * that carry the entrance themselves (see ../deviceSceneHost).
   */
  instantEntry?: boolean;
  /**
   * The scene's clock stands down at its opening still, and clearing the
   * flag restarts the loop from 0 — for instances a presenter keeps
   * mounted but hidden (see ../deviceSceneHost).
   */
  paused?: boolean;
  /**
   * The troupe grant: every listed scene stays built on the glass, parked
   * hidden, and `animation` names the visible one — a crossing is an
   * opacity flip, never a build. Presenters grow the list over idle beats
   * and carry the fades themselves; while the list is non-empty it
   * replaces the single-scene swap grammar (see ../deviceSceneHost).
   */
  warmScenes?: readonly IClassicDeviceScene[];
}

export function ClassicDevice({
  width,
  animation,
  screenContent,
  instantEntry,
  paused,
  warmScenes,
}: IClassicDeviceProps) {
  const target = typeof animation === 'string' ? animation : undefined;
  const {
    displayed,
    slot,
    animation: sceneAnimation,
  } = useSceneScreen(
    warmScenes?.length ? undefined : target,
    SCENES,
    instantEntry,
    paused,
  );
  const troupe = useSceneTroupe(
    target,
    warmScenes,
    SCENES,
    instantEntry,
    paused,
  );
  const okPress = useSharedValue(0);
  const pressDrive = useMemo(() => ({ ok: okPress }), [okPress]);
  const deviceAnimation: IClassicDeviceAnimation = useMemo(
    () => ({ screenContent: sceneAnimation.screenContent, press: pressDrive }),
    [pressDrive, sceneAnimation],
  );
  const troupeAnimation: IClassicDeviceAnimation = useMemo(
    () => ({
      screenContent: troupe.animation.screenContent,
      press: pressDrive,
    }),
    [pressDrive, troupe.animation],
  );
  if (troupe.slot) {
    return (
      <ClassicPressContext.Provider value={pressDrive}>
        <ClassicDeviceShell
          width={width}
          animation={troupeAnimation}
          screenContent={troupe.slot}
        />
      </ClassicPressContext.Provider>
    );
  }
  if (displayed) {
    return (
      <ClassicPressContext.Provider value={pressDrive}>
        <ClassicDeviceShell
          width={width}
          animation={deviceAnimation}
          screenContent={slot}
        />
      </ClassicPressContext.Provider>
    );
  }
  // Anything else counts as dark: the bare shell is dark, and whether a
  // custom contract lights the glass is its caller's business.
  return (
    <ClassicDeviceShell
      width={width}
      animation={typeof animation === 'string' ? undefined : animation}
      screenContent={typeof animation === 'string' ? undefined : screenContent}
    />
  );
}
