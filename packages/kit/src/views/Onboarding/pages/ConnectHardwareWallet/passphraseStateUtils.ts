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

  const refreshedState =
    await backgroundApiProxy.serviceHardware.getDeviceState({
      connectId: device.connectId ?? '',
      params: { scope: 'settings' },
    });
  if (typeof refreshedState.status.passphraseProtection === 'boolean') {
    return refreshedState.status.passphraseProtection;
  }

  throw new OneKeyLocalError('Unable to determine Pro2 passphrase state');
}
