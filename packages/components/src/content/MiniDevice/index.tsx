import { useSceneScreen, useSceneTroupe } from '../deviceSceneHost';

import { SCENES } from './scenes';
import { MiniDeviceShell } from './shell';

import type { IMiniDeviceScene } from './scenes';
import type { IMiniDeviceAnimation, IMiniDeviceShellProps } from './shell';

export type { IMiniDeviceScene } from './scenes';
export type { IMiniDeviceAnimation } from './shell';

/**
 * Code-drawn OneKey Mini device. Reached through ../HardwareDevice, which
 * is what call sites use; this layer is where the Mini's scenes and
 * screen live.
 *
 *   <MiniDevice animation="connecting" />       the OneKey mark
 *   <MiniDevice animation="enterPin" />         the entry row loop
 *   <MiniDevice animation="enterPassphrase" />
 *   <MiniDevice animation="confirm" />          the light sweep
 *   <MiniDevice />                              static shell, screen dark
 *
 * Scenes run on the shared presence machinery (../deviceSceneHost), the
 * same way every replica's do. The screens are the Classic's — the same
 * OLED family — re-laid for the Mini's near-square glass (./scenes). The
 * family's scenes also steer an OK-key press drive; the Mini provides
 * none (its keys do not move, by design), so those presses land nowhere.
 */
export interface IMiniDeviceProps extends Omit<
  IMiniDeviceShellProps,
  'animation'
> {
  /**
   * A built-in scene name, or a custom animation contract. With a scene name
   * the scene supplies the screen, so `screenContent` is ignored.
   */
  animation?: IMiniDeviceScene | IMiniDeviceAnimation;
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
  warmScenes?: readonly IMiniDeviceScene[];
}

export function MiniDevice({
  width,
  animation,
  screenContent,
  instantEntry,
  paused,
  warmScenes,
}: IMiniDeviceProps) {
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
      <MiniDeviceShell
        width={width}
        animation={troupe.animation}
        screenContent={troupe.slot}
      />
    );
  }
  if (displayed) {
    return (
      <MiniDeviceShell
        width={width}
        animation={sceneAnimation}
        screenContent={slot}
      />
    );
  }
  // Anything else counts as dark: the bare shell is dark, and whether a
  // custom contract lights the glass is its caller's business.
  return (
    <MiniDeviceShell
      width={width}
      animation={typeof animation === 'string' ? undefined : animation}
      screenContent={typeof animation === 'string' ? undefined : screenContent}
    />
  );
}
