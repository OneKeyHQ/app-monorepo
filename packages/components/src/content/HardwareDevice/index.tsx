import { ClassicDevice } from '../ClassicDevice';
import { ProDevice } from '../ProDevice';

import type { IClassicDeviceScene } from '../ClassicDevice';
import type { IProDeviceScene } from '../ProDevice';

/**
 * The code-drawn hardware devices. This is the entry point; ../ClassicDevice
 * and ../ProDevice are the per-model drawings behind it, not a second way in.
 * Call sites hold the model at runtime and fix the scenario at build time:
 *
 *   <HardwareDevice deviceType={deviceType} animation="confirm" />
 *
 * It owns the two mappings that would otherwise be copied to every call site:
 * the Classic family collapsing onto one replica, and models without a
 * replica rendering nothing.
 *
 * Only the routing is shared. The two shells stay apart because they draw
 * different objects - the Classic carries noise, blurs, four physical keys
 * and a 256x128 OLED; the Pro has none of that and a 288x484 touchscreen -
 * and what they genuinely have in common already lives in ../deviceScene.
 * Live screen content, when something needs it, attaches per model at that
 * layer, where the canvas and the key presses are known.
 */

/**
 * Every value of the hardware SDK's EDeviceType, as plain strings. Declared
 * here rather than imported so @onekeyhq/components stays clear of the
 * hardware SDK; the enum's members assign to these literals, so callers pass
 * their `deviceType` straight through.
 */
export type IHardwareDeviceType =
  | 'unknown'
  | 'classic'
  | 'classic1s'
  | 'classicpure'
  | 'mini'
  | 'touch'
  | 'pro';

/**
 * The scenes every replica implements. Intersecting the per-device unions
 * keeps this honest without a second list to maintain: a scene added to only
 * one device drops out of the shared set instead of being wrongly offered.
 */
export type IHardwareDeviceScene = IClassicDeviceScene & IProDeviceScene;

export interface IHardwareDeviceProps {
  /**
   * Model of the connected device. Models with no replica yet (mini, touch,
   * unknown) render nothing, as does a missing device.
   */
  deviceType?: IHardwareDeviceType | null;
  /** Built-in scene loop. Omitted: a static device with a dark screen. */
  animation?: IHardwareDeviceScene;
  /** Rendered width in points; height follows each model's aspect ratio. */
  width?: number;
}

export function HardwareDevice({
  deviceType,
  animation,
  width,
}: IHardwareDeviceProps) {
  switch (deviceType) {
    case 'classic':
    case 'classic1s':
    case 'classicpure':
      return <ClassicDevice width={width} animation={animation} />;
    case 'pro':
      return <ProDevice width={width} animation={animation} />;
    default:
      return null;
  }
}
