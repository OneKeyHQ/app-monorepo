import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import type { IDBDevice } from '../../dbs/local/types';

export async function getHwHiddenWalletPassphraseState({
  vendor,
  connectId,
  dbDevice,
  serviceHardware,
  serviceThirdPartyHardware,
}: {
  vendor?: EHardwareVendor;
  connectId: string;
  // Passed for Trezor so the passphrase-state call can fall back to BLE (same
  // as the signing path); a BLE-only Trezor otherwise fails with DeviceNotFound.
  dbDevice?: IDBDevice;
  serviceHardware: {
    getPassphraseState(params: {
      connectId: string;
      forceInputPassphrase: boolean;
    }): Promise<string | undefined>;
  };
  serviceThirdPartyHardware: {
    getTrezorPassphraseState(params: {
      connectId: string;
      dbDevice?: IDBDevice;
    }): Promise<string | null>;
  };
}): Promise<string | null | undefined> {
  if (vendor === EHardwareVendor.trezor) {
    return serviceThirdPartyHardware.getTrezorPassphraseState({
      connectId,
      dbDevice,
    });
  }

  if (vendor && getVendorProfile(vendor).isThirdParty) {
    throw new OneKeyLocalError(
      `${vendor} hidden wallet passphraseState is not supported`,
    );
  }

  return serviceHardware.getPassphraseState({
    connectId,
    forceInputPassphrase: true,
  });
}
