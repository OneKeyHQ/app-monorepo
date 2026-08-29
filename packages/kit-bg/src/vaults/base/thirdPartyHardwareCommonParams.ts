import { devicePassphraseParamsFromWallet } from '@onekeyhq/shared/src/hardware/devicePassphraseParams';

import type {
  IDevicePassphraseParams,
  IDeviceSharedCallParams,
} from '@onekeyhq/shared/types/device';

import type { ICommonCallParams } from '@onekeyfe/hwk-adapter-core';

export function thirdPartyCommonCallParamsForCreateScene(scene: {
  isAutoCreateMultiNetwork?: boolean;
}): ICommonCallParams | undefined {
  return scene.isAutoCreateMultiNetwork ? { autoInstallApp: false } : undefined;
}

export function thirdPartyPassphraseParamsFromDeviceParams(
  deviceParams: IDeviceSharedCallParams | undefined,
): IDevicePassphraseParams | Record<string, never> {
  if (!deviceParams?.deviceCommonParams) {
    return {};
  }
  return devicePassphraseParamsFromWallet(
    deviceParams.deviceCommonParams.passphraseState,
  );
}
