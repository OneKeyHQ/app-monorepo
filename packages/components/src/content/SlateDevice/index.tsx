import { useSceneScreen } from '../deviceSceneHost';

import { SCENES } from './scenes';
import { SlateDeviceShell } from './shell';

import type { ISlateDeviceAnimation } from './animation';
import type { ISlateDeviceScene } from './scenes';
import type { ISlateDeviceShellProps } from './shell';

export type { ISlateDeviceScene } from './scenes';
export type { ISlateDeviceAnimation } from './animation';

/**
 * Code-drawn Slate device. Reached through ../HardwareDevice, which is what
 * call sites use; this layer is where the device's own scenes and screen
 * live.
 *
 *   <SlateDevice animation="connecting" />       the idle wallpaper
 *   <SlateDevice animation="enterPin" />         the keypad loop
 *   <SlateDevice animation="enterPassphrase" />  the ASCII keyboard loop
 *   <SlateDevice animation="confirm" />          the light sweep
 *   <SlateDevice />                              static shell, screen dark
 *
 * The glass stays pure black; "lighting up" is only content rendering onto
 * it, and every scene enters that way — one shared entrance, exit and
 * clock (../deviceSceneHost), driven by the scene's SCENES registry entry
 * (./scenes.tsx), which is also where every per-scene trait is declared.
 * The shell chrome mounts once here; a scene change only swaps the screen
 * slot's content. A change away from a scene with content on the glass
 * plays the swap: the outgoing content fades off, then the incoming scene
 * renders in — one continuous move, no waiting built in (callers sequence
 * anything else after SCREEN_SWAP_MS, see ../deviceScene). `animation`
 * also accepts a custom ISlateDeviceAnimation contract (see ./animation.ts)
 * paired with your own `screenContent` on the 288x484 canvas.
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
  const {
    displayed,
    slot,
    animation: sceneAnimation,
  } = useSceneScreen(target, SCENES);
  if (displayed) {
    return (
      <SlateDeviceShell
        width={width}
        animation={sceneAnimation}
        screenContent={slot}
      />
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
