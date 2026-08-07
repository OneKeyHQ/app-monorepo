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
 *   <SlateDevice animation="connecting" />       slow wake to the wallpaper
 *   <SlateDevice animation="enterPin" />         static still
 *   <SlateDevice animation="confirm" />          static still
 *   <SlateDevice animation="enterPassphrase" />  no design yet: dark glass
 *   <SlateDevice />                              static shell, screen dark
 *
 * enterPin and confirm are static stills; their tap choreography arrives
 * once it is motion designed. `animation` also accepts a custom
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
  if (typeof animation === 'string') {
    const Scene = SCENES[animation];
    return <Scene width={width} />;
  }
  return (
    <SlateDeviceShell
      width={width}
      animation={animation}
      screenContent={screenContent}
    />
  );
}
