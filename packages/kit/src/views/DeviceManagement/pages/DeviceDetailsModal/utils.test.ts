import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { canOpenDeviceManagementDetails } from './utils';

describe('DeviceDetailsModal utils', () => {
  it('allows Ledger rows to open device details', () => {
    expect(canOpenDeviceManagementDetails(EHardwareVendor.ledger)).toBe(true);
  });

  it('keeps unsupported third-party rows non-clickable', () => {
    expect(canOpenDeviceManagementDetails(EHardwareVendor.trezor)).toBe(false);
  });
});
