import { Icon, Stack } from '../../primitives';
import { STAGE_BG } from '../MorphOverlay';

import type { IDeviceStageConnectionType } from './type';
import type { TextStyle } from 'react-native';

const BADGE_SIZE = 18;
/** The Bluetooth badge's channel blue, so both channel marks read as one family. */
const BADGE_BG = '#3378F6';
const ICON_STYLE: TextStyle = { color: '#FFFFFF', width: 12, height: 12 };

/** The vendor track's channel mark: a small corner badge over the product shot. */
export function ChannelCornerBadge({
  connectionType,
}: {
  connectionType: IDeviceStageConnectionType;
}) {
  return (
    <Stack
      testID={`device-stage-channel-badge-${connectionType}`}
      position="absolute"
      right={-2}
      bottom={-2}
      width={BADGE_SIZE}
      height={BADGE_SIZE}
      borderRadius="$full"
      borderWidth={2}
      borderColor={STAGE_BG}
      bg={BADGE_BG}
      alignItems="center"
      justifyContent="center"
    >
      <Icon
        name={connectionType === 'bluetooth' ? 'BluetoothSolid' : 'UsbSolid'}
        style={ICON_STYLE}
      />
    </Stack>
  );
}
