import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { showDeviceListDialog } from './DeviceListDialog';

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
  ]);
}
