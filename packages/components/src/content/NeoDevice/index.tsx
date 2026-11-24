import type {
  IHardwareDeviceColor,
  INeoDeviceColor,
} from '@onekeyhq/shared/src/utils/hardwareDeviceColors';

import { Pro2Device } from '../Pro2Device';

import type { IPro2DeviceProps } from '../Pro2Device';
import type { ImageSourcePropType } from 'react-native';

/**
 * The Neo's baked chrome, one bitmap per finish (shell-neo-<color>@2x/@3x,
 * exported from the Figma frame at 280pt like the Pro 2's;
 * shared/utils/hardwareDeviceColors says which a serial number names).
 * The model-and-color suffix keeps every filename unique: webpack/rspack
 * dev emits assets as bare [name].[ext], where same-named files overwrite
 * each other.
 */
const NEO_SHELLS: Record<INeoDeviceColor, ImageSourcePropType> = {
  White: require('./shell-neo-white.png'),
  Black: require('./shell-neo-black.png'),
  Green: require('./shell-neo-green.png'),
  Pink: require('./shell-neo-pink.png'),
};

/** The finish's chrome; a color the Neo does not come in wears white. */
function pickShell(color: IHardwareDeviceColor | undefined) {
  return color && color in NEO_SHELLS
    ? NEO_SHELLS[color as INeoDeviceColor]
    : NEO_SHELLS.White;
}

export type INeoDeviceProps = Omit<IPro2DeviceProps, 'shellSource'>;

/**
 * Code-drawn Neo device: the Pro 2's geometry, screen canvas and scenes
 * under the Neo's own baked chrome. Reached through ../HardwareDevice; the
 * scene grammar is ../Pro2Device's. `color` picks the finish — white, the
 * Neo's default, when omitted or unknown.
 */
export function NeoDevice({
  width,
  animation,
  screenContent,
  instantEntry,
  paused,
  warmScenes,
  color,
}: INeoDeviceProps) {
  return (
    <Pro2Device
      width={width}
      animation={animation}
      screenContent={screenContent}
      instantEntry={instantEntry}
      paused={paused}
      warmScenes={warmScenes}
      shellSource={pickShell(color)}
    />
  );
}
