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
 * what the physical device shows at that moment.
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
 * collapses onto one; models missing here (mini, touch, unknown) have no
 * replica and render nothing. Both the component and the swap timing
 * below read it, so "has a replica" is stated exactly once.
 */
const REPLICAS: Partial<
  Record<
    IHardwareDeviceType,
    typeof ClassicDevice | typeof ProDevice | typeof SlateDevice
  >
> = {
  classic: ClassicDevice,
  classic1s: ClassicDevice,
  classicpure: ClassicDevice,
  pro: ProDevice,
  slate: SlateDevice,
};

/**
 * How long this model takes to hand its screen from one scene to the next,
 * so a caller sequencing its own moves after the replica's can queue behind
 * it. Every replica plays the handover — content fades off the glass before
 * the next scene renders in; a model without a replica has no screen to
 * hand over.
 *
 * Part of the routing contract on purpose: reading it off a per-model
 * module would go around this entry point.
 */
export function hardwareDeviceSwapMs(
  deviceType?: IHardwareDeviceType | null,
): number {
  return deviceType && REPLICAS[deviceType] ? SCREEN_SWAP_MS : 0;
}

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
