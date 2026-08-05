import { SlateDeviceShell } from './shell';

import type { ISlateDeviceAnimation } from './animation';
import type { ISlateDeviceShellProps } from './shell';

export type { ISlateDeviceAnimation } from './animation';

/**
 * Code-drawn Slate device. Reached through ../HardwareDevice, which is what
 * call sites use; this layer is where the device's own scenes and screen
 * will live.
 *
 * No built-in scenes yet - the replica ships as a static shell, so unlike
 * the siblings `animation` only accepts the raw contract (see ./animation.ts)
 * paired with your own `screenContent` on the 288x484 canvas. Scene loops
 * arrive here once they are designed, and the scene-name union with them.
 */
export interface ISlateDeviceProps extends Omit<
  ISlateDeviceShellProps,
  'animation'
> {
  /** A custom animation contract; scene names come later. */
  animation?: ISlateDeviceAnimation;
}

export function SlateDevice({
  width,
  animation,
  screenContent,
}: ISlateDeviceProps) {
  return (
    <SlateDeviceShell
      width={width}
      animation={animation}
      screenContent={screenContent}
    />
  );
}
