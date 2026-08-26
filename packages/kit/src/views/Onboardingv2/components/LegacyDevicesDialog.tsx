import { EDeviceType } from '@onekeyfe/hd-shared';

import { getDeviceLabel } from '../deviceLabel';
import { OnboardingTestIDs } from '../testIDs';

import { showDeviceListDialog } from './DeviceListDialog';

const miniImage = require('@onekeyhq/kit/assets/pick-mini.png');
const touchImage = require('@onekeyhq/kit/assets/pick-touch.png');

// Legacy entries stay full OneKey flows (firmware check included) — they only
// share the dialog-style entry point with third-party brands, never the
// vendor route.
const LEGACY_DEVICES = [
  { deviceType: EDeviceType.Mini, image: miniImage },
  { deviceType: EDeviceType.Touch, image: touchImage },
];

export function showLegacyDevicesDialog() {
  showDeviceListDialog(
    LEGACY_DEVICES.map(({ deviceType, image }) => ({
      title: getDeviceLabel([deviceType]),
      image,
      testID: OnboardingTestIDs.pickYourDeviceLegacyOptionBtn(deviceType),
      logKey: deviceType,
      routeParams: { deviceType: [deviceType] },
    })),
  );
}
