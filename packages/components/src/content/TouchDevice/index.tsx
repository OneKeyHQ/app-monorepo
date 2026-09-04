import { useSceneScreen, useSceneTroupe } from '../deviceSceneHost';
import { createScenes } from '../ProDevice/scenes';

import { TOUCH_FACE, TouchDeviceShell } from './shell';

import type { ITouchDeviceAnimation, ITouchDeviceShellProps } from './shell';
import type { IProDeviceScene } from '../ProDevice/scenes';

export type { ITouchDeviceAnimation } from './shell';

/**
 * The Touch runs the Pro's screens — the same scenes, same names — on its
 * own glass; the registry is built for the Touch's panel color (see
 * ../ProDevice/scenes createScenes).
 */
export type ITouchDeviceScene = IProDeviceScene;
const SCENES = createScenes(TOUCH_FACE);

/**
 * Code-drawn OneKey Touch device. Reached through ../HardwareDevice, which
 * is what call sites use; this layer is where the Touch's screen lives.
 *
 *   <TouchDevice animation="connecting" />       the idle wallpaper
 *   <TouchDevice animation="enterPin" />         the keypad loop
 *   <TouchDevice animation="enterPassphrase" />  the qwerty keyboard loop
 *   <TouchDevice animation="confirm" />          the light sweep
 *   <TouchDevice />                              static shell, screen dark
 *
 * Scenes run on the shared presence machinery (../deviceSceneHost), the
 * same way the Pro's do — they ARE the Pro's, paint-scaled into the
 * Touch's screen window by the shell. `animation` also accepts a custom
 * ITouchDeviceAnimation contract paired with your own `screenContent` on
 * the Pro's 288x484 canvas.
 */
export interface ITouchDeviceProps extends Omit<
  ITouchDeviceShellProps,
  'animation'
> {
  /**
   * A built-in scene name, or a custom animation contract. With a scene name
   * the scene supplies the screen, so `screenContent` is ignored.
   */
  animation?: ITouchDeviceScene | ITouchDeviceAnimation;
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
   * opacity flip, never a build (see ../deviceSceneHost).
   */
  warmScenes?: readonly ITouchDeviceScene[];
}

export function TouchDevice({
  width,
  animation,
  screenContent,
  instantEntry,
  paused,
  warmScenes,
}: ITouchDeviceProps) {
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
      <TouchDeviceShell
        width={width}
        animation={troupe.animation}
        screenContent={troupe.slot}
      />
    );
  }
  if (displayed) {
    return (
      <TouchDeviceShell
        width={width}
        animation={sceneAnimation}
        screenContent={slot}
      />
    );
  }
  // Anything else counts as dark: the bare shell is dark, and whether a
  // custom contract lights the glass is its caller's business.
  return (
    <TouchDeviceShell
      width={width}
      animation={typeof animation === 'string' ? undefined : animation}
      screenContent={typeof animation === 'string' ? undefined : screenContent}
    />
  );
}
