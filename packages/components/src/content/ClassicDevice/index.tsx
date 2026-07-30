import type { ReactNode } from 'react';

import { SCENES } from './scenes';
import { ClassicDeviceShell } from './shell';

import type { IClassicDeviceAnimation } from './animation';
import type { IClassicDeviceScene } from './scenes';

export type { IClassicDeviceScene } from './scenes';
export type { IClassicDeviceAnimation } from './animation';

/**
 * Code-drawn OneKey Classic device. One component, one `animation` prop:
 *
 *   <ClassicDevice animation="confirm" />          built-in scene loop
 *   <ClassicDevice animation="enterPin" />
 *   <ClassicDevice animation="enterPassphrase" />
 *   <ClassicDevice />                              static shell, screen dark
 *
 * Advanced: `animation` also accepts a custom IClassicDeviceAnimation
 * contract (see ./animation.ts) paired with your own `screenContent` node.
 * Switching scene names remounts, so the loop restarts from the top.
 */
export interface IClassicDeviceProps {
  /**
   * Rendered width in points. Height follows the fixed 327:539 aspect ratio.
   * Shrinking is visually free; enlarging softens beyond roughly 430 (see
   * the scaling note in ./shell.tsx).
   */
  width?: number;
  /** A built-in scene name, or a custom animation contract. */
  animation?: IClassicDeviceScene | IClassicDeviceAnimation;
  /** Custom screen content; ignored when `animation` is a scene name. */
  screenContent?: ReactNode;
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
