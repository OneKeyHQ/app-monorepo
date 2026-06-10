import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

export async function getHwHiddenWalletPassphraseState({
  vendor,
  connectId,
  serviceHardware,
  serviceThirdPartyHardware,
}: {
  vendor?: EHardwareVendor;
  connectId: string;
  serviceHardware: {
    getPassphraseState(params: {
      connectId: string;
      forceInputPassphrase: boolean;
    }): Promise<string | undefined>;
  };
  serviceThirdPartyHardware: {
    getTrezorPassphraseState(params: {
      connectId: string;
    }): Promise<string | null>;
  };
}): Promise<string | null | undefined> {
  if (vendor === EHardwareVendor.trezor) {
    return serviceThirdPartyHardware.getTrezorPassphraseState({ connectId });
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
