import { EDeviceType } from '@onekeyfe/hd-shared';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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
  if (typeof features.passphraseProtection === 'boolean') {
    return features.passphraseProtection;
  }

  let deviceType = await deviceUtils.getDeviceTypeFromFeatures({
    features,
  });
  if (deviceType === 'unknown') {
    deviceType = device.deviceType;
  }

  if (deviceType !== EDeviceType.Pro2) {
    return Boolean(features.passphraseProtection);
  }

  const refreshedFeatures =
    await backgroundApiProxy.serviceHardware.getFeaturesWithoutCache({
      connectId: device.connectId ?? '',
    });
  if (typeof refreshedFeatures.passphraseProtection === 'boolean') {
    return refreshedFeatures.passphraseProtection;
  }

  throw new OneKeyLocalError('Unable to determine Pro2 passphrase state');
}
