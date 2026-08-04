import { SCENES } from './scenes';
import { ProDeviceShell } from './shell';

import type { IProDeviceAnimation } from './animation';
import type { IProDeviceScene } from './scenes';
import type { IProDeviceShellProps } from './shell';

export type { IProDeviceScene } from './scenes';
export type { IProDeviceAnimation } from './animation';

/**
 * Code-drawn OneKey Pro device. One component, one `animation` prop:
 *
 *   <ProDevice animation="confirm" />          built-in scene loop
 *   <ProDevice animation="enterPin" />
 *   <ProDevice animation="enterPassphrase" />
 *   <ProDevice />                              static shell, screen dark
 *
 * Advanced: `animation` also accepts a custom IProDeviceAnimation contract
 * (see ./animation.ts) paired with your own `screenContent`. Switching scene
 * names remounts, so the loop restarts from the top.
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
  if (typeof animation === 'string') {
    const Scene = SCENES[animation];
    return <Scene width={width} />;
  }
  return (
    <ProDeviceShell
      width={width}
      animation={animation}
      screenContent={screenContent}
    />
  );
}
