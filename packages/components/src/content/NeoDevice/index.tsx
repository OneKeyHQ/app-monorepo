import { Pro2Device } from '../Pro2Device';

import type { IPro2DeviceProps } from '../Pro2Device';

// The model suffix keeps the filename unique: webpack/rspack dev emits
// assets as bare [name].[ext], where same-named files overwrite each other.
const SHELL_SOURCE = require('./shell-neo.png');

export type INeoDeviceProps = Omit<IPro2DeviceProps, 'shellSource'>;

/**
 * Code-drawn Neo device: the Pro 2's geometry, screen canvas and scenes
 * under the Neo's own baked chrome (shell-neo@2x/@3x, exported from the
 * Figma frame at 280pt like the Pro 2's). Reached through ../HardwareDevice;
 * the scene grammar is ../Pro2Device's.
 */
export function NeoDevice({
  width,
  animation,
  screenContent,
  instantEntry,
  paused,
  warmScenes,
}: INeoDeviceProps) {
  return (
    <Pro2Device
      width={width}
      animation={animation}
      screenContent={screenContent}
      instantEntry={instantEntry}
      paused={paused}
      warmScenes={warmScenes}
      shellSource={SHELL_SOURCE}
    />
  );
}
