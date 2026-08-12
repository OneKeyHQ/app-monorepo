import { useSceneScreen } from '../deviceSceneHost';

import { SCENES } from './scenes';
import { ProDeviceShell } from './shell';

import type { IProDeviceAnimation } from './animation';
import type { IProDeviceScene } from './scenes';
import type { IProDeviceShellProps } from './shell';

export type { IProDeviceScene } from './scenes';
export type { IProDeviceAnimation } from './animation';

/**
 * Code-drawn OneKey Pro device. Reached through ../HardwareDevice, which is
 * what call sites use; this layer is where the Pro's own scenes and screen
 * live.
 *
 *   <ProDevice animation="connecting" />       the idle wallpaper
 *   <ProDevice animation="enterPin" />         the keypad loop
 *   <ProDevice animation="enterPassphrase" />  the qwerty keyboard loop
 *   <ProDevice animation="confirm" />          the light sweep
 *   <ProDevice />                              static shell, screen dark
 *
 * Scenes run on the shared presence machinery (../deviceSceneHost), the
 * same way the Slate's do: content renders in as the whole of an entry,
 * stays lit while the scene is on, and a scene change plays the lit-to-lit
 * handover (callers sequence anything else after SCREEN_SWAP_MS, see
 * ../deviceScene). The shell chrome mounts once here; a scene change only
 * swaps the screen slot's content. `animation` also accepts a custom
 * IProDeviceAnimation contract (see ./animation.ts) paired with your own
 * `screenContent` on the 288x484 touchscreen canvas.
 */
export interface IProDeviceProps extends Omit<
  IProDeviceShellProps,
  'animation'
> {
  /**
   * A built-in scene name, or a custom animation contract. With a scene name
   * the scene supplies the screen, so `screenContent` is ignored.
   */
  animation?: IProDeviceScene | IProDeviceAnimation;
}

export function ProDevice({
  width,
  animation,
  screenContent,
}: IProDeviceProps) {
  const target = typeof animation === 'string' ? animation : undefined;
  const {
    displayed,
    slot,
    animation: sceneAnimation,
  } = useSceneScreen(target, SCENES);
  if (displayed) {
    return (
      <ProDeviceShell
        width={width}
        animation={sceneAnimation}
        screenContent={slot}
      />
    );
  }
  // Anything else counts as dark: the bare shell is dark, and whether a
  // custom contract lights the glass is its caller's business.
  return (
    <ProDeviceShell
      width={width}
      animation={typeof animation === 'string' ? undefined : animation}
      screenContent={typeof animation === 'string' ? undefined : screenContent}
    />
  );
}
