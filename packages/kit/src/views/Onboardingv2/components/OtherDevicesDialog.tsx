import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { showDeviceListDialog } from './DeviceListDialog';

const keystoneLogo = require('@onekeyhq/kit/assets/pick-keystone.png');
const ledgerLogo = require('@onekeyhq/kit/assets/pick-ledger.png');
const trezorLogo = require('@onekeyhq/kit/assets/pick-trezor.png');

export function showOtherDevicesDialog() {
  showDeviceListDialog([
    {
      title: 'Ledger',
      image: ledgerLogo,
      logKey: EHardwareVendor.ledger,
      routeParams: { deviceType: [], vendor: EHardwareVendor.ledger },
    },
    {
      title: 'Trezor',
      image: trezorLogo,
      logKey: EHardwareVendor.trezor,
      routeParams: { deviceType: [], vendor: EHardwareVendor.trezor },
    },
    {
      title: 'Keystone',
      image: keystoneLogo,
      logKey: EHardwareVendor.keystone,
      routeName: EOnboardingPagesV2.ConnectKeystoneDevice,
      routeParams: { deviceType: [], vendor: EHardwareVendor.keystone },
    },
  ]);
}
