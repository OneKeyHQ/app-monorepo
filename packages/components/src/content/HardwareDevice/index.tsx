import { ClassicDevice } from '../ClassicDevice';
import { MiniDevice } from '../MiniDevice';
import { ProDevice } from '../ProDevice';
import { TouchDevice } from '../TouchDevice';

import type { IClassicDeviceScene } from '../ClassicDevice';
import type { IMiniDeviceScene } from '../MiniDevice';
import type { IProDeviceScene } from '../ProDevice';
import type { ITouchDeviceScene } from '../TouchDevice';

/**
 * The code-drawn hardware devices. This is the entry point; ../ClassicDevice,
 * ../MiniDevice, ../ProDevice and ../TouchDevice are the per-model drawings
 * behind it, not a second way in. Call sites hold the model at runtime and
 * fix the scenario at build time:
 *
 *   <HardwareDevice deviceType={deviceType} animation="confirm" />
 *
 * It owns the two mappings that would otherwise be copied to every call site:
 * the Classic family collapsing onto one replica, and models without a
 * replica rendering nothing.
 *
 * Only the routing is shared. The shells stay apart because they draw
 * different objects - the Classic carries noise, blurs, four physical keys
 * and a 256x128 OLED; the Mini is a white slab with a near-square OLED and
 * four engraved membrane keys (its screens are the Classic's, re-laid);
 * the Pro has none of that and a 288x484 touchscreen; the Touch is a
 * slab with a wide bezel whose screen window runs the Pro's screens,
 * scaled - and what they genuinely have in common already lives in
 * ../deviceScene. Live screen content, when something needs it, attaches
 * per model at that layer, where the canvas and the key presses are known.
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
  | 'pro'
  | 'pro2'
  | 'neo';

/**
 * The scenes every replica implements. Intersecting the per-device unions
 * keeps this honest without a second list to maintain: a scene added to
 * only one device drops out of the shared set instead of being wrongly
 * offered. A device may implement a scene as a dark screen when that is
 * what the physical device shows at that moment.
 */
export type IHardwareDeviceScene = IClassicDeviceScene &
  IMiniDeviceScene &
  IProDeviceScene &
  ITouchDeviceScene;

export interface IHardwareDeviceProps {
  /**
   * Model of the connected device. A model with no replica (unknown)
   * renders nothing, as does a missing device.
   */
  deviceType?: IHardwareDeviceType | null;
  /** Built-in scene. Omitted: a static device with a dark screen. */
  animation?: IHardwareDeviceScene;
  /** Rendered width in points; height follows each model's aspect ratio. */
  width?: number;
  /**
   * The next entry arrives already lit — granted per arrival by presenters
   * that carry the entrance themselves (see ../deviceSceneHost).
   */
  instantEntry?: boolean;
  /**
   * The scene's clock stands down at its opening still, and clearing the
   * flag restarts the loop from 0. For instances a presenter keeps mounted
   * but hidden: a parked screen neither animates unseen nor gets caught
   * mid-loop by its reveal.
   */
  paused?: boolean;
  /**
   * The troupe grant: every listed scene stays built on the glass, parked
   * hidden, and `animation` names the visible one — a crossing is an
   * opacity flip, never a build. Presenters grow the list over idle beats
   * and carry the fades themselves; while the list is non-empty it
   * replaces the single-scene swap grammar (see ../deviceSceneHost).
   */
  warmScenes?: readonly IHardwareDeviceScene[];
}

/**
 * The routing table: which models draw which replica. The Classic family
 * collapses onto one; a model missing here (unknown) has no replica
 * and renders nothing, so "has a replica" is stated exactly once.
 */
const REPLICAS: Partial<
  Record<
    IHardwareDeviceType,
    | typeof ClassicDevice
    | typeof MiniDevice
    | typeof ProDevice
    | typeof TouchDevice
  >
> = {
  classic: ClassicDevice,
  classic1s: ClassicDevice,
  classicpure: ClassicDevice,
  mini: MiniDevice,
  pro: ProDevice,
  touch: TouchDevice,
  // The Pro 2 and the Neo stand on the Pro replica until their own shells
  // and screens ship; those live on claude/pro2-neo-device-assets and land
  // with the hardware release (OK-59934).
  pro2: ProDevice,
  neo: ProDevice,
};

export function HardwareDevice({
  deviceType,
  animation,
  width,
  instantEntry,
  paused,
  warmScenes,
}: IHardwareDeviceProps) {
  const Replica = deviceType ? REPLICAS[deviceType] : undefined;
  if (!Replica) return null;
  return (
    <Replica
      width={width}
      animation={animation}
      instantEntry={instantEntry}
      paused={paused}
      warmScenes={warmScenes}
    />
  );
}
