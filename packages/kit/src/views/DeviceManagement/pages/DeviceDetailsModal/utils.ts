import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

export function canOpenDeviceManagementDetails(
  vendor: EHardwareVendor | undefined,
) {
  const profile = getVendorProfile(vendor ?? EHardwareVendor.onekey);
  if (!profile.isThirdParty) {
    return true;
  }
  return vendor === EHardwareVendor.ledger;
}
