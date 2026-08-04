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
 *   <ClassicDevice animation="confirm" />          built-in scene loop
 *   <ClassicDevice animation="enterPin" />
 *   <ClassicDevice animation="enterPassphrase" />
 *   <ClassicDevice />                              static shell, screen dark
 *
 * `animation` also accepts a custom IClassicDeviceAnimation contract (see
 * ./animation.ts) paired with your own `screenContent` - the way live content
 * would go on the 256x128 OLED, which is the whole point of drawing the
 * device in code rather than shipping a Lottie. Switching scene names
 * remounts, so the loop restarts from the top.
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
}

export function ClassicDevice({
  width,
  animation,
  screenContent,
}: IClassicDeviceProps) {
  if (typeof animation === 'string') {
    const Scene = SCENES[animation];
    return <Scene width={width} />;
  }
  return (
    <ClassicDeviceShell
      width={width}
      animation={animation}
      screenContent={screenContent}
    />
  );
}
