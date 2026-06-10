import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';

import type { ICommonCallParams } from '@onekeyfe/hwk-adapter-core';

export function thirdPartyCommonCallParamsForCreateScene(scene: {
  isAutoCreateMultiNetwork?: boolean;
}): ICommonCallParams | undefined {
  return scene.isAutoCreateMultiNetwork ? { autoInstallApp: false } : undefined;
}

export function thirdPartyPassphraseParamsFromDeviceParams(
  deviceParams: IDeviceSharedCallParams | undefined,
): { passphraseState?: string } {
  const passphraseState = deviceParams?.deviceCommonParams?.passphraseState;
  return passphraseState ? { passphraseState } : {};
}
