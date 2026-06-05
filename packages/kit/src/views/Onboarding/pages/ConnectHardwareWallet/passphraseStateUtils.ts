import { EDeviceType } from '@onekeyfe/hd-shared';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';

import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';
import type { SearchDevice } from '@onekeyfe/hd-core';

export async function resolveHardwarePassphraseEnabled({
  device,
  features,
}: {
  device: SearchDevice;
  features: IOneKeyDeviceFeatures;
}) {
  if (typeof features.passphrase_protection === 'boolean') {
    return features.passphrase_protection;
  }

  let deviceType = await deviceUtils.getDeviceTypeFromFeatures({
    features,
  });
  if (deviceType === 'unknown') {
    deviceType = device.deviceType;
  }

  if (deviceType !== EDeviceType.Pro2) {
    return Boolean(features.passphrase_protection);
  }

  try {
    const passphraseStatePayload =
      await backgroundApiProxy.serviceHardware.getPassphraseStateBase({
        connectId: device.connectId ?? '',
        forceInputPassphrase: false,
        useEmptyPassphrase: true,
      });
    const passphraseEnabled = Boolean(
      passphraseStatePayload?.passphrase_state ||
      passphraseStatePayload?.passphrase_protection === true,
    );

    if (passphraseEnabled) {
      features.passphrase_protection = true;
    }
    if (passphraseStatePayload?.unlocked_attach_pin !== undefined) {
      features.unlocked_attach_pin = passphraseStatePayload.unlocked_attach_pin;
    }

    return passphraseEnabled;
  } catch (error) {
    console.warn(
      '[resolveHardwarePassphraseEnabled] failed to read Pro2 passphrase state',
      error,
    );
    return false;
  }
}
