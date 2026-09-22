import { useSceneScreen, useSceneTroupe } from '../deviceSceneHost';

import { SCENES } from './scenes';
import { Pro2DeviceShell } from './shell';

import type { IPro2DeviceAnimation } from './animation';
import type { IPro2DeviceScene } from './scenes';
import type { IPro2DeviceShellProps } from './shell';

export type { IPro2DeviceScene } from './scenes';
export type { IPro2DeviceAnimation } from './animation';

/**
 * Code-drawn Pro 2 device. Reached through ../HardwareDevice, which is what
 * call sites use; this layer is where the device's own scenes and screen
 * live.
 *
 *   <Pro2Device animation="connecting" />       the idle wallpaper
 *   <Pro2Device animation="enterPin" />         the keypad loop
 *   <Pro2Device animation="enterPassphrase" />  the ASCII keyboard loop
 *   <Pro2Device animation="confirm" />          the light sweep
 *   <Pro2Device />                              static shell, screen dark
 *
 * The glass stays pure black; "lighting up" is only content rendering onto
 * it, and every scene enters that way — one shared entrance, exit and
 * clock (../deviceSceneHost), driven by the scene's SCENES registry entry
 * (./scenes.tsx), which is also where every per-scene trait is declared.
 * The shell chrome mounts once here; a scene change only swaps the screen
 * slot's content. A change away from a scene with content on the glass
 * plays the swap: the outgoing content fades off, then the incoming scene
 * renders in — one continuous move, no waiting built in. `animation`
 * also accepts a custom IPro2DeviceAnimation contract (see ./animation.ts)
 * paired with your own `screenContent` on the 288x484 canvas.
 */
export interface IPro2DeviceProps extends Omit<
  IPro2DeviceShellProps,
  'animation'
> {
  /**
   * A built-in scene name, or a custom animation contract. With a scene name
   * the scene supplies the screen, so `screenContent` is ignored.
   */
  animation?: IPro2DeviceScene | IPro2DeviceAnimation;
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
  warmScenes?: readonly IPro2DeviceScene[];
}

export function Pro2Device({
  width,
  animation,
  screenContent,
  instantEntry,
  paused,
  warmScenes,
}: IPro2DeviceProps) {
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
  if (troupe.slot) {
    return (
      <Pro2DeviceShell
        width={width}
        animation={troupe.animation}
        screenContent={troupe.slot}
      />
    );
  }
  if (displayed) {
    return (
      <Pro2DeviceShell
        width={width}
        animation={sceneAnimation}
        screenContent={slot}
      />
    );
  }
  // Anything else counts as dark: the bare shell is dark, and whether a
  // custom contract lights the glass is its caller's business.
  return (
    <Pro2DeviceShell
      width={width}
      animation={typeof animation === 'string' ? undefined : animation}
      screenContent={typeof animation === 'string' ? undefined : screenContent}
    />
  );
}
