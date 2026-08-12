import { ClassicDevice } from '../ClassicDevice';
import { SCREEN_SWAP_MS } from '../deviceScene';
import { ProDevice } from '../ProDevice';
import { SlateDevice } from '../SlateDevice';

import type { IClassicDeviceScene } from '../ClassicDevice';
import type { IProDeviceScene } from '../ProDevice';
import type { ISlateDeviceScene } from '../SlateDevice';

/**
 * The code-drawn hardware devices. This is the entry point; ../ClassicDevice,
 * ../ProDevice and ../SlateDevice are the per-model drawings behind it, not
 * a second way in. Call sites hold the model at runtime and fix the scenario
 * at build time:
 *
 *   <HardwareDevice deviceType={deviceType} animation="confirm" />
 *
 * It owns the two mappings that would otherwise be copied to every call site:
 * the Classic family collapsing onto one replica, and models without a
 * replica rendering nothing.
 *
 * Only the routing is shared. The shells stay apart because they draw
 * different objects - the Classic carries noise, blurs, four physical keys
 * and a 256x128 OLED; the Pro has none of that and a 288x484 touchscreen;
 * the Slate is an edge-to-edge glass slab in a blurred-stroke metal frame -
 * and what they genuinely have in common already lives in ../deviceScene.
 * Live screen content, when something needs it, attaches per model at that
 * layer, where the canvas and the key presses are known.
 */

/**
 * Every value of the hardware SDK's EDeviceType, as plain strings. Declared
 * here rather than imported so @onekeyhq/components stays clear of the
 * hardware SDK; the enum's members assign to these literals, so callers pass
 * their `deviceType` straight through.
 *
 * 'slate' is the one local-only member: an in-design replica whose device
 * has no SDK enum value yet. It renames to the real value when one ships.
 */
export type IHardwareDeviceType =
  | 'unknown'
  | 'classic'
  | 'classic1s'
  | 'classicpure'
  | 'mini'
  | 'touch'
  | 'pro'
  | 'slate';

/**
 * The scenes every replica implements. Intersecting the per-device unions
 * keeps this honest without a second list to maintain: a scene added to
 * only one device drops out of the shared set instead of being wrongly
 * offered. A device may implement a scene as a dark screen when that is
 * what the physical device shows at that moment (connecting on the
 * Classic and Pro).
 */
export type IHardwareDeviceScene = IClassicDeviceScene &
  IProDeviceScene &
  ISlateDeviceScene;

export interface IHardwareDeviceProps {
  /**
   * Model of the connected device. Models with no replica yet (mini, touch,
   * unknown) render nothing, as does a missing device.
   */
  deviceType?: IHardwareDeviceType | null;
  /** Built-in scene. Omitted: a static device with a dark screen. */
  animation?: IHardwareDeviceScene;
  /** Rendered width in points; height follows each model's aspect ratio. */
  width?: number;
}

/**
 * How long this model takes to hand its screen from one scene to the next,
 * so a caller sequencing its own moves after the replica's can queue behind
 * it. The presence-model replicas (Pro, Slate) play a handover — content
 * fades off the glass before the next scene renders in — while the Classic
 * cuts straight over.
 *
 * Part of the routing contract on purpose: reading it off a per-model
 * module would both go around this entry point and, since not every model
 * has a handover, make the Classic wait for a beat it never plays.
 */
export function hardwareDeviceSwapMs(
  deviceType?: IHardwareDeviceType | null,
): number {
  return deviceType === 'pro' || deviceType === 'slate' ? SCREEN_SWAP_MS : 0;
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
    case 'slate':
      return <SlateDevice width={width} animation={animation} />;
    default:
      return null;
  }
}
